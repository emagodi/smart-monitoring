package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.clients.NotificationClient;
import com.safalifter.transformerservice.config.AccessScopeService;
import com.safalifter.transformerservice.entities.Alert;
import com.safalifter.transformerservice.entities.AlertCase;
import com.safalifter.transformerservice.entities.AlertCaseActivity;
import com.safalifter.transformerservice.entities.AlertDispatch;
import com.safalifter.transformerservice.entities.ResponseVehicle;
import com.safalifter.transformerservice.entities.Transformer;
import com.safalifter.transformerservice.entities.TransformerType;
import com.safalifter.transformerservice.enums.AlertCaseActivityType;
import com.safalifter.transformerservice.enums.AlertCaseStatus;
import com.safalifter.transformerservice.enums.DispatchStatus;
import com.safalifter.transformerservice.enums.IncidentOutcome;
import com.safalifter.transformerservice.enums.VehicleStatus;
import com.safalifter.transformerservice.payload.client.NotificationType;
import com.safalifter.transformerservice.payload.client.SendNotificationRequest;
import com.safalifter.transformerservice.payload.request.response.CloseIncidentRequest;
import com.safalifter.transformerservice.payload.request.response.DispatchRequest;
import com.safalifter.transformerservice.payload.request.response.DispatchStatusRequest;
import com.safalifter.transformerservice.payload.request.response.VehicleRequest;
import com.safalifter.transformerservice.payload.response.AlertResponse;
import com.safalifter.transformerservice.payload.response.response.CrewIncidentView;
import com.safalifter.transformerservice.payload.response.response.DispatchResponse;
import com.safalifter.transformerservice.payload.response.response.ResponseBoardResponse;
import com.safalifter.transformerservice.payload.response.response.VehicleResponse;
import com.safalifter.transformerservice.repository.AlertCaseActivityRepository;
import com.safalifter.transformerservice.repository.AlertCaseRepository;
import com.safalifter.transformerservice.repository.AlertDispatchRepository;
import com.safalifter.transformerservice.repository.AlertQueryRepository;
import com.safalifter.transformerservice.repository.AlertRepository;
import com.safalifter.transformerservice.repository.ResponseVehicleRepository;
import com.safalifter.transformerservice.repository.TransformerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collection;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Incident response lifecycle on top of alert cases:
 * acknowledge -> dispatch a vehicle -> crew accepts (en route) -> crew on scene -> close with outcome.
 *
 * Crews do not need a system login: each dispatch carries a random token that is sent to the
 * crew lead by SMS / WhatsApp / email as a link to the public crew page.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class ResponseService {

    public static final String PERM_RESPOND = "response.acknowledge";
    public static final String PERM_DISPATCH = "response.dispatch";
    public static final String PERM_CLOSE = "response.close";
    public static final String PERM_READ = "response.read";
    public static final String PERM_FLEET_MANAGE = "fleet.update";

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("dd MMM HH:mm");
    private static final Set<DispatchStatus> ACTIVE_DISPATCH = EnumSet.of(DispatchStatus.DISPATCHED, DispatchStatus.ACCEPTED, DispatchStatus.ON_SCENE);

    private final AlertRepository alertRepository;
    private final AlertCaseRepository alertCaseRepository;
    private final AlertCaseActivityRepository activityRepository;
    private final AlertDispatchRepository dispatchRepository;
    private final ResponseVehicleRepository vehicleRepository;
    private final TransformerRepository transformerRepository;
    private final AlertQueryRepository alertQueryRepository;
    private final AlertStateService alertStateService;
    private final AccessScopeService accessScopeService;
    private final NotificationClient notificationClient;

    /** Public base URL used to build crew links, e.g. http://154.73.80.22 */
    @Value("${app.public-base-url:http://154.73.80.22}")
    private String publicBaseUrl = "http://154.73.80.22";

    // ------------------------------------------------------------------ board

    @Transactional(readOnly = true)
    public ResponseBoardResponse board() {
        requirePermission(PERM_READ);
        AlertQueryRepository.AlertFilter openFilter = new AlertQueryRepository.AlertFilter(
                accessScopeService.getCurrentSupplierCode(), accessScopeService.getCurrentDepotId(), "open", null, null);
        AlertQueryRepository.AlertFilter closedFilter = new AlertQueryRepository.AlertFilter(
                accessScopeService.getCurrentSupplierCode(), accessScopeService.getCurrentDepotId(), "closed_recent", null, null);
        List<AlertResponse> open = alertQueryRepository.findPage(openFilter, 0, 300);
        List<AlertResponse> closed = alertQueryRepository.findPage(closedFilter, 0, 60);

        List<Long> caseIds = new ArrayList<>();
        open.forEach(a -> { if (a.getCaseId() != null) caseIds.add(a.getCaseId()); });
        closed.forEach(a -> { if (a.getCaseId() != null) caseIds.add(a.getCaseId()); });
        Map<Long, List<DispatchResponse>> dispatchesByCase = caseIds.isEmpty() ? Map.of()
                : dispatchRepository.findAllByAlertCaseIdInOrderByIdDesc(caseIds).stream()
                .map(this::toDispatchResponse)
                .collect(Collectors.groupingBy(DispatchResponse::getAlertCaseId, LinkedHashMap::new, Collectors.toList()));

        List<ResponseVehicle> vehicles = scopedVehicles();
        return ResponseBoardResponse.builder()
                .open(open.stream().map(a -> board(a, dispatchesByCase)).toList())
                .recentlyClosed(closed.stream().map(a -> board(a, dispatchesByCase)).toList())
                .vehiclesAvailable((int) vehicles.stream().filter(v -> v.getStatus() == VehicleStatus.AVAILABLE).count())
                .vehiclesDispatched((int) vehicles.stream().filter(v -> v.getStatus() == VehicleStatus.DISPATCHED).count())
                .vehiclesOutOfService((int) vehicles.stream().filter(v -> v.getStatus() == VehicleStatus.OUT_OF_SERVICE).count())
                .generatedAt(LocalDateTime.now())
                .build();
    }

    private ResponseBoardResponse.BoardCase board(AlertResponse alert, Map<Long, List<DispatchResponse>> dispatchesByCase) {
        return ResponseBoardResponse.BoardCase.builder()
                .alert(alert)
                .dispatches(alert.getCaseId() != null ? dispatchesByCase.getOrDefault(alert.getCaseId(), List.of()) : List.of())
                .build();
    }

    @Transactional(readOnly = true)
    public List<DispatchResponse> dispatchesForAlert(Long alertId) {
        requirePermission(PERM_READ);
        AlertCase alertCase = caseForAlert(loadVisibleAlert(alertId));
        return dispatchRepository.findAllByAlertCaseIdOrderByIdDesc(alertCase.getId()).stream()
                .map(this::toDispatchResponse).toList();
    }

    // ------------------------------------------------------------- operator actions

    public AlertResponse acknowledge(Long alertId, String note) {
        requirePermission(PERM_RESPOND);
        Alert alert = loadVisibleAlert(alertId);
        AlertCase alertCase = caseForAlert(alert);
        requireOpen(alertCase);
        String actor = currentActor();
        AlertCaseStatus before = alertCase.getStatus();
        if (before == AlertCaseStatus.NEW) {
            alertCase.setStatus(AlertCaseStatus.ACKNOWLEDGED);
            alertCase.setAcknowledgedAt(LocalDateTime.now());
        }
        if (alertCase.getAssignedToEmail() == null && alertCase.getAssignedToName() == null) {
            alertCase.setAssignedToEmail(actor);
            alertCase.setAssignedToName(actor);
            alertCase.setAssignedAt(LocalDateTime.now());
        }
        touch(alertCase, actor, note != null ? note : "Alert acknowledged by contact centre");
        alertCaseRepository.save(alertCase);
        activity(alertCase.getId(), before != alertCase.getStatus() ? AlertCaseActivityType.STATUS_CHANGED : AlertCaseActivityType.NOTE_ADDED,
                before, alertCase.getStatus(), actor, note != null ? note : "Acknowledged");
        alertStateService.refresh(alert.getTransformerId());
        return reload(alertId);
    }

    public DispatchResponse dispatch(Long alertId, DispatchRequest request) {
        requirePermission(PERM_DISPATCH);
        if (request == null || request.getVehicleId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a vehicle to dispatch");
        }
        Alert alert = loadVisibleAlert(alertId);
        AlertCase alertCase = caseForAlert(alert);
        requireOpen(alertCase);

        ResponseVehicle vehicle = vehicleRepository.findById(request.getVehicleId())
                .filter(ResponseVehicle::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Vehicle not found"));
        if (vehicle.getStatus() == VehicleStatus.OUT_OF_SERVICE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, vehicle.getRegistration() + " is out of service");
        }
        if (vehicle.getStatus() == VehicleStatus.DISPATCHED && !Boolean.TRUE.equals(request.getForce())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, vehicle.getRegistration() + " is already on another job");
        }

        String actor = currentActor();
        LocalDateTime now = LocalDateTime.now();
        AlertDispatch dispatch = dispatchRepository.save(AlertDispatch.builder()
                .alertCaseId(alertCase.getId())
                .alertId(alert.getId())
                .vehicleId(vehicle.getId())
                .vehicleRegistration(vehicle.getRegistration())
                .vehicleCallSign(vehicle.getCallSign())
                .crewLeadName(vehicle.getCrewLeadName())
                .crewLeadPhone(vehicle.getCrewLeadPhone())
                .crewLeadWhatsapp(vehicle.getCrewLeadWhatsapp())
                .crewLeadEmail(vehicle.getCrewLeadEmail())
                .status(DispatchStatus.DISPATCHED)
                .crewToken(newToken())
                .dispatchedByEmail(actor)
                .dispatchNote(trim(request.getNote()))
                .dispatchedAt(now)
                .build());

        vehicle.setStatus(VehicleStatus.DISPATCHED);
        vehicleRepository.save(vehicle);

        AlertCaseStatus before = alertCase.getStatus();
        if (before == AlertCaseStatus.NEW || before == AlertCaseStatus.ACKNOWLEDGED) {
            alertCase.setStatus(AlertCaseStatus.DISPATCHED);
            if (alertCase.getAcknowledgedAt() == null) {
                alertCase.setAcknowledgedAt(now);
            }
        }
        if (alertCase.getDispatchedAt() == null) {
            alertCase.setDispatchedAt(now);
        }
        String summary = "Dispatched " + vehicleLabel(vehicle) + crewSuffix(vehicle.getCrewLeadName());
        touch(alertCase, actor, summary);
        alertCaseRepository.save(alertCase);
        activity(alertCase.getId(), AlertCaseActivityType.VEHICLE_DISPATCHED, before, alertCase.getStatus(), actor,
                summary + (dispatch.getDispatchNote() != null ? ". " + dispatch.getDispatchNote() : ""));
        alertStateService.refresh(alert.getTransformerId());

        boolean notified = false;
        if (!Boolean.FALSE.equals(request.getNotifyCrew())) {
            notified = notifyCrew(dispatch, alert);
        }
        DispatchResponse response = toDispatchResponse(dispatch);
        response.setCrewNotified(notified);
        return response;
    }

    public DispatchResponse updateDispatch(Long dispatchId, DispatchStatusRequest request) {
        requirePermission(PERM_DISPATCH);
        AlertDispatch dispatch = dispatchRepository.findById(dispatchId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Dispatch not found"));
        Alert alert = loadVisibleAlert(dispatch.getAlertId());
        if (request == null || request.getStatus() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status is required");
        }
        applyDispatchStatus(dispatch, alert, request.getStatus(), trim(request.getNote()), currentActor());
        return toDispatchResponse(dispatch);
    }

    public AlertResponse close(Long alertId, CloseIncidentRequest request) {
        requirePermission(PERM_CLOSE);
        Alert alert = loadVisibleAlert(alertId);
        closeInternal(alert, request, currentActor());
        return reload(alertId);
    }

    // ------------------------------------------------------------------ crew link

    @Transactional(readOnly = true)
    public CrewIncidentView crewView(String token) {
        AlertDispatch dispatch = dispatchByToken(token);
        return toCrewView(dispatch);
    }

    public CrewIncidentView crewAction(String token, String action, CloseIncidentRequest closeRequest, String note) {
        AlertDispatch dispatch = dispatchByToken(token);
        Alert alert = alertRepository.findById(dispatch.getAlertId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Incident not found"));
        String actor = "Crew " + firstNonBlank(dispatch.getCrewLeadName(), "") + " (" + firstNonBlank(dispatch.getVehicleRegistration(), "vehicle") + ")";
        switch (action) {
            case "accept" -> applyDispatchStatus(dispatch, alert, DispatchStatus.ACCEPTED, trim(note), actor.trim());
            case "arrive" -> applyDispatchStatus(dispatch, alert, DispatchStatus.ON_SCENE, trim(note), actor.trim());
            case "close" -> {
                if (!dispatch.getStatus().isActive()) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "This dispatch is no longer active");
                }
                closeInternal(alert, closeRequest, actor.trim());
            }
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown action");
        }
        return toCrewView(dispatchRepository.findById(dispatch.getId()).orElse(dispatch));
    }

    // ------------------------------------------------------------------ fleet

    @Transactional(readOnly = true)
    public List<VehicleResponse> vehicles() {
        requirePermission(PERM_READ);
        List<ResponseVehicle> vehicles = scopedVehicles();
        Map<Long, AlertDispatch> activeByVehicle = activeDispatchByVehicle(vehicles.stream().map(ResponseVehicle::getId).toList());
        Map<Long, String> transformerNames = new LinkedHashMap<>();
        activeByVehicle.values().forEach(d -> alertRepository.findById(d.getAlertId())
                .ifPresent(a -> transformerNames.put(d.getAlertId(), a.getTransformerName())));
        return vehicles.stream().map(v -> toVehicleResponse(v, activeByVehicle.get(v.getId()), transformerNames)).toList();
    }

    public VehicleResponse saveVehicle(Long id, VehicleRequest request) {
        requirePermission(PERM_FLEET_MANAGE);
        if (request == null || request.getRegistration() == null || request.getRegistration().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Registration is required");
        }
        String registration = request.getRegistration().trim().toUpperCase();
        ResponseVehicle vehicle;
        if (id == null) {
            if (vehicleRepository.existsByRegistrationIgnoreCaseAndActiveTrue(registration)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, registration + " is already registered");
            }
            vehicle = new ResponseVehicle();
            vehicle.setActive(true);
            vehicle.setStatus(VehicleStatus.AVAILABLE);
        } else {
            vehicle = vehicleRepository.findById(id).filter(ResponseVehicle::isActive)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Vehicle not found"));
        }
        vehicle.setRegistration(registration);
        vehicle.setCallSign(trim(request.getCallSign()));
        vehicle.setVehicleType(trim(request.getVehicleType()));
        vehicle.setDepotId(request.getDepotId());
        vehicle.setDepotName(trim(request.getDepotName()));
        vehicle.setCrewLeadName(trim(request.getCrewLeadName()));
        vehicle.setCrewLeadPhone(trim(request.getCrewLeadPhone()));
        vehicle.setCrewLeadWhatsapp(trim(request.getCrewLeadWhatsapp()));
        vehicle.setCrewLeadEmail(trim(request.getCrewLeadEmail()));
        vehicle.setCrewSize(request.getCrewSize());
        vehicle.setNotes(trim(request.getNotes()));
        if (request.getStatus() != null && request.getStatus() != VehicleStatus.DISPATCHED) {
            // DISPATCHED is only ever set by an actual dispatch
            boolean onJob = !activeDispatchByVehicle(vehicle.getId() != null ? List.of(vehicle.getId()) : List.of()).isEmpty();
            if (!onJob) {
                vehicle.setStatus(request.getStatus());
            }
        }
        ResponseVehicle saved = vehicleRepository.save(vehicle);
        return toVehicleResponse(saved, null, Map.of());
    }

    public void deleteVehicle(Long id) {
        requirePermission(PERM_FLEET_MANAGE);
        ResponseVehicle vehicle = vehicleRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Vehicle not found"));
        if (!activeDispatchByVehicle(List.of(id)).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Vehicle is on a job; recall it first");
        }
        vehicle.setActive(false);
        vehicleRepository.save(vehicle);
    }

    // ------------------------------------------------------------------ internals

    private void applyDispatchStatus(AlertDispatch dispatch, Alert alert, DispatchStatus target, String note, String actor) {
        DispatchStatus current = dispatch.getStatus();
        if (!current.isActive()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This dispatch is already " + current.name().toLowerCase());
        }
        AlertCase alertCase = caseForAlert(alert);
        LocalDateTime now = LocalDateTime.now();
        AlertCaseStatus before = alertCase.getStatus();
        String summary;
        switch (target) {
            case ACCEPTED -> {
                if (current != DispatchStatus.DISPATCHED) {
                    return; // already accepted / on scene: idempotent
                }
                dispatch.setStatus(DispatchStatus.ACCEPTED);
                dispatch.setAcceptedAt(now);
                if (alertCase.getStatus().isOpen() && alertCase.getStatus().ordinal() < AlertCaseStatus.EN_ROUTE.ordinal()) {
                    alertCase.setStatus(AlertCaseStatus.EN_ROUTE);
                }
                if (alertCase.getEnRouteAt() == null) {
                    alertCase.setEnRouteAt(now);
                }
                summary = vehicleLabel(dispatch) + " accepted and is en route";
            }
            case ON_SCENE -> {
                if (current == DispatchStatus.ON_SCENE) {
                    return;
                }
                if (dispatch.getAcceptedAt() == null) {
                    dispatch.setAcceptedAt(now);
                }
                dispatch.setStatus(DispatchStatus.ON_SCENE);
                dispatch.setOnSceneAt(now);
                if (alertCase.getStatus().isOpen()) {
                    alertCase.setStatus(AlertCaseStatus.ON_SCENE);
                }
                if (alertCase.getEnRouteAt() == null) {
                    alertCase.setEnRouteAt(now);
                }
                if (alertCase.getOnSceneAt() == null) {
                    alertCase.setOnSceneAt(now);
                }
                summary = vehicleLabel(dispatch) + " arrived on scene";
            }
            case CANCELLED -> {
                dispatch.setStatus(DispatchStatus.CANCELLED);
                dispatch.setCancelledAt(now);
                releaseVehicle(dispatch.getVehicleId(), dispatch.getId());
                boolean otherActive = dispatchRepository.findAllByAlertCaseIdOrderByIdDesc(alertCase.getId()).stream()
                        .anyMatch(d -> !d.getId().equals(dispatch.getId()) && d.getStatus().isActive());
                if (!otherActive && alertCase.getStatus().isOpen()
                        && alertCase.getStatus().ordinal() >= AlertCaseStatus.DISPATCHED.ordinal()) {
                    alertCase.setStatus(AlertCaseStatus.ACKNOWLEDGED);
                }
                summary = vehicleLabel(dispatch) + " recalled";
            }
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use close to complete an incident");
        }
        if (note != null) {
            dispatch.setLastCrewNote(note);
        }
        dispatchRepository.save(dispatch);
        touch(alertCase, actor, note != null ? summary + ": " + note : summary);
        alertCaseRepository.save(alertCase);
        activity(alertCase.getId(), target == DispatchStatus.CANCELLED ? AlertCaseActivityType.DISPATCH_CANCELLED : AlertCaseActivityType.CREW_UPDATE,
                before, alertCase.getStatus(), actor, note != null ? summary + ". " + note : summary);
        alertStateService.refresh(alert.getTransformerId());
    }

    private void closeInternal(Alert alert, CloseIncidentRequest request, String actor) {
        if (request == null || request.getOutcome() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose an outcome: real threat, false alarm, technical fault, authorised activity or other");
        }
        AlertCase alertCase = caseForAlert(alert);
        requireOpen(alertCase);
        LocalDateTime now = LocalDateTime.now();
        AlertCaseStatus before = alertCase.getStatus();
        IncidentOutcome outcome = request.getOutcome();
        String note = trim(request.getNote());

        alertCase.setOutcome(outcome);
        alertCase.setOutcomeNote(note);
        alertCase.setClosedAt(now);
        alertCase.setClosedByName(actor);
        if (alertCase.getAcknowledgedAt() == null) {
            alertCase.setAcknowledgedAt(now);
        }
        if (outcome == IncidentOutcome.FALSE_ALARM) {
            alertCase.setStatus(AlertCaseStatus.FALSE_ALARM);
            alertCase.setFalseAlarmAt(now);
        } else {
            alertCase.setStatus(AlertCaseStatus.RESOLVED);
            alertCase.setResolvedAt(now);
        }
        String summary = "Closed as " + outcomeLabel(outcome);
        touch(alertCase, actor, note != null ? summary + ": " + note : summary);
        alertCaseRepository.save(alertCase);

        for (AlertDispatch d : dispatchRepository.findAllByAlertCaseIdOrderByIdDesc(alertCase.getId())) {
            if (d.getStatus().isActive()) {
                if (d.getAcceptedAt() == null) d.setAcceptedAt(now);
                d.setStatus(DispatchStatus.COMPLETED);
                d.setCompletedAt(now);
                dispatchRepository.save(d);
                releaseVehicle(d.getVehicleId(), d.getId());
            }
        }
        activity(alertCase.getId(), AlertCaseActivityType.OUTCOME_RECORDED, before, alertCase.getStatus(), actor,
                note != null ? summary + ". " + note : summary);
        alertStateService.refresh(alert.getTransformerId());
    }

    private void releaseVehicle(Long vehicleId, Long exceptDispatchId) {
        if (vehicleId == null) return;
        vehicleRepository.findById(vehicleId).ifPresent(v -> {
            boolean stillBusy = dispatchRepository.findAllByVehicleIdInAndStatusIn(List.of(vehicleId), ACTIVE_DISPATCH).stream()
                    .anyMatch(d -> !d.getId().equals(exceptDispatchId));
            if (!stillBusy && v.getStatus() == VehicleStatus.DISPATCHED) {
                v.setStatus(VehicleStatus.AVAILABLE);
                vehicleRepository.save(v);
            }
        });
    }

    private boolean notifyCrew(AlertDispatch dispatch, Alert alert) {
        if (isBlank(dispatch.getCrewLeadPhone()) && isBlank(dispatch.getCrewLeadWhatsapp()) && isBlank(dispatch.getCrewLeadEmail())) {
            return false;
        }
        String link = crewLink(dispatch.getCrewToken());
        String message = "RAPID RESPONSE: " + firstNonBlank(alert.getValue(), "Security alert") + " at "
                + firstNonBlank(alert.getTransformerName(), "transformer")
                + (alert.getLat() != null && alert.getLng() != null
                    ? " (map: https://maps.google.com/?q=" + alert.getLat().toPlainString() + "," + alert.getLng().toPlainString() + ")" : "")
                + ". Vehicle " + vehicleLabel(dispatch) + ", dispatched " + TIME.format(dispatch.getDispatchedAt())
                + (dispatch.getDispatchNote() != null ? ". Note: " + dispatch.getDispatchNote() : "")
                + ". Accept / arrive / close here: " + link;
        try {
            notificationClient.send(SendNotificationRequest.builder()
                    .notificationType(NotificationType.SYSTEM_NOTICE)
                    .supplierCode(alert.getSupplierCode())
                    .depotId(alert.getDepotId())
                    .sourceSystem("transformer-service")
                    .referenceId(String.valueOf(alert.getId()))
                    .recipientName(dispatch.getCrewLeadName())
                    .phone(dispatch.getCrewLeadPhone())
                    .whatsappNumber(dispatch.getCrewLeadWhatsapp())
                    .email(dispatch.getCrewLeadEmail())
                    .subject("Rapid response dispatch: " + firstNonBlank(alert.getTransformerName(), "transformer"))
                    .message(message)
                    .build());
            return true;
        } catch (Exception ex) {
            log.warn("Crew notification failed for dispatch {}: {}", dispatch.getId(), ex.getMessage());
            return false;
        }
    }

    private CrewIncidentView toCrewView(AlertDispatch dispatch) {
        Alert alert = alertRepository.findById(dispatch.getAlertId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Incident not found"));
        AlertCase alertCase = alertCaseRepository.findByAlertId(alert.getId()).orElse(null);
        Transformer transformer = alert.getTransformerId() != null ? transformerRepository.findById(alert.getTransformerId()).orElse(null) : null;
        boolean active = dispatch.getStatus().isActive();
        boolean caseOpen = alertCase != null && alertCase.getStatus().isOpen();
        return CrewIncidentView.builder()
                .transformerName(alert.getTransformerName())
                .transformerType(transformer != null && transformer.getType() != null
                        ? (transformer.getType() == TransformerType.GROUND_MOUNTED ? "Ground mounted (GMT)"
                        : transformer.getType() == TransformerType.POLE_MOUNTED ? "Pole mounted (PMT)" : transformer.getType().name())
                        : null)
                .event(firstNonBlank(alert.getValue(), alert.getMessage()))
                .depotName(alert.getDepotName())
                .lat(alert.getLat())
                .lng(alert.getLng())
                .detectedAt(alert.getCreatedAt())
                .occurrenceCount(alert.getOccurrenceCount())
                .caseStatus(alertCase != null ? alertCase.getStatus().name() : null)
                .outcome(alertCase != null && alertCase.getOutcome() != null ? alertCase.getOutcome().name() : null)
                .vehicleRegistration(dispatch.getVehicleRegistration())
                .vehicleCallSign(dispatch.getVehicleCallSign())
                .crewLeadName(dispatch.getCrewLeadName())
                .dispatchStatus(dispatch.getStatus().name())
                .dispatchNote(dispatch.getDispatchNote())
                .dispatchedAt(dispatch.getDispatchedAt())
                .acceptedAt(dispatch.getAcceptedAt())
                .onSceneAt(dispatch.getOnSceneAt())
                .completedAt(dispatch.getCompletedAt())
                .canAccept(active && caseOpen && dispatch.getStatus() == DispatchStatus.DISPATCHED)
                .canArrive(active && caseOpen && dispatch.getStatus() != DispatchStatus.ON_SCENE)
                .canClose(active && caseOpen)
                .build();
    }

    private AlertDispatch dispatchByToken(String token) {
        if (token == null || token.length() < 20) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Link not found");
        }
        return dispatchRepository.findByCrewToken(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Link not found or expired"));
    }

    private Map<Long, AlertDispatch> activeDispatchByVehicle(Collection<Long> vehicleIds) {
        if (vehicleIds.isEmpty()) return Map.of();
        Map<Long, AlertDispatch> out = new LinkedHashMap<>();
        for (AlertDispatch d : dispatchRepository.findAllByVehicleIdInAndStatusIn(vehicleIds, ACTIVE_DISPATCH)) {
            out.merge(d.getVehicleId(), d, (a, b) -> a.getId() > b.getId() ? a : b);
        }
        return out;
    }

    private List<ResponseVehicle> scopedVehicles() {
        Long depotId = accessScopeService.getCurrentDepotId();
        if (accessScopeService.isSupplierScoped()) {
            return List.of(); // partners do not manage ZESA response vehicles
        }
        return depotId != null
                ? vehicleRepository.findAllByActiveTrueAndDepotIdOrderByRegistrationAsc(depotId)
                : vehicleRepository.findAllByActiveTrueOrderByDepotNameAscRegistrationAsc();
    }

    private Alert loadVisibleAlert(Long alertId) {
        Alert alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alert " + alertId + " not found"));
        String supplierCode = accessScopeService.getCurrentSupplierCode();
        Long depotId = accessScopeService.getCurrentDepotId();
        boolean visible = (supplierCode == null || supplierCode.equalsIgnoreCase(String.valueOf(alert.getSupplierCode())))
                && (depotId == null || depotId.equals(alert.getDepotId()));
        if (!visible) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Alert " + alertId + " not found");
        }
        return alert;
    }

    private AlertCase caseForAlert(Alert alert) {
        return alertCaseRepository.findByAlertId(alert.getId()).orElseGet(() -> {
            AlertCase created = alertCaseRepository.save(AlertCase.builder()
                    .alertId(alert.getId())
                    .status(AlertCaseStatus.NEW)
                    .lastActionAt(LocalDateTime.now())
                    .lastActionNote("Case opened")
                    .build());
            activity(created.getId(), AlertCaseActivityType.CASE_CREATED, null, AlertCaseStatus.NEW, currentActor(), "Case opened");
            return created;
        });
    }

    private void requireOpen(AlertCase alertCase) {
        if (!alertCase.getStatus().isOpen()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This incident is already closed");
        }
    }

    private void requirePermission(String permission) {
        if (accessScopeService.isSupplierScoped() && !PERM_READ.equals(permission)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Partner accounts cannot run the response workflow");
        }
        if (!accessScopeService.hasPermission(permission)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Missing permission: " + permission);
        }
    }

    private void touch(AlertCase alertCase, String actor, String note) {
        alertCase.setLastActionAt(LocalDateTime.now());
        alertCase.setLastActionByEmail(actor);
        alertCase.setLastActionByName(actor);
        alertCase.setLastActionNote(note);
    }

    private void activity(Long caseId, AlertCaseActivityType type, AlertCaseStatus before, AlertCaseStatus after, String actor, String note) {
        activityRepository.save(AlertCaseActivity.builder()
                .alertCaseId(caseId)
                .activityType(type)
                .statusBefore(before)
                .statusAfter(after)
                .actorEmail(actor)
                .actorName(actor)
                .note(note)
                .build());
    }

    private AlertResponse reload(Long alertId) {
        return alertQueryRepository.findById(alertId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alert not found"));
    }

    private DispatchResponse toDispatchResponse(AlertDispatch d) {
        return DispatchResponse.builder()
                .id(d.getId())
                .alertId(d.getAlertId())
                .alertCaseId(d.getAlertCaseId())
                .vehicleId(d.getVehicleId())
                .vehicleRegistration(d.getVehicleRegistration())
                .vehicleCallSign(d.getVehicleCallSign())
                .crewLeadName(d.getCrewLeadName())
                .crewLeadPhone(d.getCrewLeadPhone())
                .crewLeadWhatsapp(d.getCrewLeadWhatsapp())
                .crewLeadEmail(d.getCrewLeadEmail())
                .status(d.getStatus().name())
                .dispatchedByEmail(d.getDispatchedByEmail())
                .dispatchNote(d.getDispatchNote())
                .lastCrewNote(d.getLastCrewNote())
                .dispatchedAt(d.getDispatchedAt())
                .acceptedAt(d.getAcceptedAt())
                .onSceneAt(d.getOnSceneAt())
                .completedAt(d.getCompletedAt())
                .cancelledAt(d.getCancelledAt())
                .crewLink(d.getStatus().isActive() ? crewLink(d.getCrewToken()) : null)
                .build();
    }

    private VehicleResponse toVehicleResponse(ResponseVehicle v, AlertDispatch active, Map<Long, String> transformerNames) {
        return VehicleResponse.builder()
                .id(v.getId())
                .registration(v.getRegistration())
                .callSign(v.getCallSign())
                .vehicleType(v.getVehicleType())
                .depotId(v.getDepotId())
                .depotName(v.getDepotName())
                .status(v.getStatus().name())
                .crewLeadName(v.getCrewLeadName())
                .crewLeadPhone(v.getCrewLeadPhone())
                .crewLeadWhatsapp(v.getCrewLeadWhatsapp())
                .crewLeadEmail(v.getCrewLeadEmail())
                .crewSize(v.getCrewSize())
                .notes(v.getNotes())
                .currentAlertId(active != null ? active.getAlertId() : null)
                .currentTransformerName(active != null ? transformerNames.get(active.getAlertId()) : null)
                .currentDispatchStatus(active != null ? active.getStatus().name() : null)
                .currentDispatchedAt(active != null ? active.getDispatchedAt() : null)
                .updatedAt(v.getUpdatedAt())
                .build();
    }

    private String crewLink(String token) {
        String base = publicBaseUrl.endsWith("/") ? publicBaseUrl.substring(0, publicBaseUrl.length() - 1) : publicBaseUrl;
        return base + "/respond/" + token;
    }

    private static String newToken() {
        byte[] bytes = new byte[24];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String currentActor() {
        String email = accessScopeService.getCurrentUserEmail();
        return email != null ? email : "system";
    }

    private static String vehicleLabel(ResponseVehicle v) {
        return v.getCallSign() != null ? v.getCallSign() + " (" + v.getRegistration() + ")" : v.getRegistration();
    }

    private static String vehicleLabel(AlertDispatch d) {
        return d.getVehicleCallSign() != null ? d.getVehicleCallSign() + " (" + d.getVehicleRegistration() + ")"
                : Objects.toString(d.getVehicleRegistration(), "Vehicle");
    }

    private static String crewSuffix(String crewLead) {
        return crewLead != null && !crewLead.isBlank() ? ", crew lead " + crewLead : "";
    }

    public static String outcomeLabel(IncidentOutcome outcome) {
        return switch (outcome) {
            case REAL_THREAT -> "real threat";
            case FALSE_ALARM -> "false alarm";
            case TECHNICAL_FAULT -> "technical fault";
            case AUTHORISED_ACTIVITY -> "authorised activity";
            case OTHER -> "other";
        };
    }

    private static String trim(String value) {
        if (value == null) return null;
        String t = value.trim();
        return t.isEmpty() ? null : t;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String firstNonBlank(String a, String b) {
        return a != null && !a.isBlank() ? a : b;
    }
}
