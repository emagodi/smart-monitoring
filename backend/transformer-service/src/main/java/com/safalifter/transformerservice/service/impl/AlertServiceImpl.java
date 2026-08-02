package com.safalifter.transformerservice.service.impl;

import com.safalifter.transformerservice.config.AccessScopeService;
import com.safalifter.transformerservice.entities.Alert;
import com.safalifter.transformerservice.entities.AlertCase;
import com.safalifter.transformerservice.entities.AlertCaseActivity;
import com.safalifter.transformerservice.entities.Sensor;
import com.safalifter.transformerservice.enums.AlertCaseActivityType;
import com.safalifter.transformerservice.enums.AlertCaseStatus;
import com.safalifter.transformerservice.payload.request.AlertCaseUpdateRequest;
import com.safalifter.transformerservice.payload.request.AlertRequest;
import com.safalifter.transformerservice.payload.response.AlertCaseActivityResponse;
import com.safalifter.transformerservice.payload.response.AlertResponse;
import com.safalifter.transformerservice.repository.AlertCaseActivityRepository;
import com.safalifter.transformerservice.repository.AlertCaseRepository;
import com.safalifter.transformerservice.repository.AlertRepository;
import com.safalifter.transformerservice.repository.SensorRepository;
import com.safalifter.transformerservice.service.AlertService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
public class AlertServiceImpl implements AlertService {

    private final AlertRepository alertRepository;
    private final SensorRepository sensorRepository;
    private final AlertCaseRepository alertCaseRepository;
    private final AlertCaseActivityRepository alertCaseActivityRepository;
    private final AccessScopeService accessScopeService;

    @Override
    public AlertResponse create(AlertRequest request) {
        Sensor sensor = null;
        if (request.getSensorId() != null) {
            sensor = findSensorOrThrow(request.getSensorId());
        }
        String supplierCode = request.getSupplierCode();
        String supplierName = request.getSupplierName();
        if ((supplierCode == null || supplierCode.isBlank()) && sensor != null) {
            supplierCode = sensor.getSupplierCode();
            supplierName = sensor.getSupplierName();
        }
        if ((supplierCode == null || supplierCode.isBlank()) && accessScopeService.isSupplierScoped()) {
            supplierCode = accessScopeService.getCurrentSupplierCode();
            supplierName = accessScopeService.getCurrentSupplierName();
        }
        Alert alert = Alert.builder()
                .sensorId(request.getSensorId())
                .cameraId(request.getCameraId())
                .value(request.getValue())
                .isAlert(Boolean.TRUE.equals(request.getIsAlert()))
                .message(request.getMessage())
                .transformerId(request.getTransformerId())
                .transformerName(request.getTransformerName())
                .transformerCapacity(request.getTransformerCapacity())
                .depotId(request.getDepotId())
                .depotName(request.getDepotName())
                .lat(request.getLat())
                .lng(request.getLng())
                .devEui(request.getDevEui())
                .deviceId(request.getDeviceId())
                .deviceName(request.getDeviceName())
                .sensorType(request.getSensorType())
                .supplierCode(supplierCode)
                .supplierName(supplierName)
                .imageUrl(request.getImageUrl())
                .build();
        Alert saved = alertRepository.save(alert);
        AlertCase alertCase = createInitialCase(saved);
        return toResponse(saved, alertCase);
    }

    @Override
    @Transactional(readOnly = true)
    public AlertResponse getById(Long id) {
        Alert alert = findAlertOrThrow(id);
        return toResponse(alert, alertCaseRepository.findByAlertId(alert.getId()).orElse(null));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AlertResponse> getAll(int page, int size) {
        int sanitizedPage = Math.max(page, 0);
        int sanitizedSize = Math.min(Math.max(size, 1), 100);
        Pageable pageable = PageRequest.of(sanitizedPage, sanitizedSize);
        Page<Alert> alerts = listScopedAlerts(pageable);
        Map<Long, AlertCase> casesByAlertId = loadCasesByAlertId(alerts.getContent());
        List<AlertResponse> content = alerts.getContent().stream()
                .map(alert -> toResponse(alert, casesByAlertId.get(alert.getId())))
                .toList();
        return new PageImpl<>(content, pageable, alerts.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public List<AlertResponse> listBySensorId(Long sensorId) {
        List<Alert> alerts = accessScopeService.isSupplierScoped()
                ? alertRepository.findBySensorIdAndSupplierCode(sensorId, accessScopeService.getCurrentSupplierCode())
                : alertRepository.findBySensorId(sensorId);
        List<Alert> visibleAlerts = alerts.stream()
                .filter(this::isVisibleToCurrentUser)
                .sorted((left, right) -> compareCreatedAtDesc(left.getCreatedAt(), right.getCreatedAt()))
                .toList();
        Map<Long, AlertCase> casesByAlertId = loadCasesByAlertId(visibleAlerts);
        return visibleAlerts.stream()
                .map(alert -> toResponse(alert, casesByAlertId.get(alert.getId())))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<AlertCaseActivityResponse> getTimeline(Long id) {
        Alert alert = findAlertOrThrow(id);
        AlertCase alertCase = alertCaseRepository.findByAlertId(alert.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alert case not found"));
        return alertCaseActivityRepository.findAllByAlertCaseIdOrderByCreatedAtAsc(alertCase.getId()).stream()
                .map(this::toActivityResponse)
                .toList();
    }

    @Override
    public AlertResponse updateCase(Long id, AlertCaseUpdateRequest request) {
        Alert alert = findAlertOrThrow(id);
        AlertCase alertCase = alertCaseRepository.findByAlertId(alert.getId()).orElseGet(() -> createInitialCase(alert));

        AlertCaseStatus previousStatus = alertCase.getStatus();
        AlertCaseStatus nextStatus = request != null && request.getStatus() != null ? request.getStatus() : previousStatus;
        String nextAssignedEmail = request != null && request.getAssignedToEmail() != null ? trimToNull(request.getAssignedToEmail()) : alertCase.getAssignedToEmail();
        String nextAssignedName = request != null && request.getAssignedToName() != null ? trimToNull(request.getAssignedToName()) : alertCase.getAssignedToName();
        String note = request != null ? trimToNull(request.getNote()) : null;

        boolean statusChanged = nextStatus != previousStatus;
        boolean assignmentTouched = request != null && (request.getAssignedToEmail() != null || request.getAssignedToName() != null);
        boolean assignmentChanged = assignmentTouched
                && (!Objects.equals(nextAssignedEmail, alertCase.getAssignedToEmail())
                || !Objects.equals(nextAssignedName, alertCase.getAssignedToName()));

        LocalDateTime now = LocalDateTime.now();
        if (statusChanged) {
            alertCase.setStatus(nextStatus);
            applyStatusTimestamp(alertCase, nextStatus, now);
        }
        if (assignmentTouched) {
            alertCase.setAssignedToEmail(nextAssignedEmail);
            alertCase.setAssignedToName(nextAssignedName);
            alertCase.setAssignedAt(nextAssignedEmail != null || nextAssignedName != null ? now : null);
        }
        if (statusChanged || assignmentChanged || note != null) {
            alertCase.setLastActionAt(now);
            alertCase.setLastActionByEmail(accessScopeService.getCurrentUserEmail());
            alertCase.setLastActionByName(accessScopeService.getCurrentUserEmail());
            alertCase.setLastActionNote(note);
        }

        AlertCase savedCase = alertCaseRepository.save(alertCase);
        if (statusChanged) {
            createActivity(savedCase.getId(), AlertCaseActivityType.STATUS_CHANGED, previousStatus, nextStatus, note);
        }
        if (assignmentChanged) {
            String assignmentNote = buildAssignmentNote(nextAssignedName, nextAssignedEmail, note);
            createActivity(savedCase.getId(), AlertCaseActivityType.ASSIGNMENT_CHANGED, savedCase.getStatus(), savedCase.getStatus(), assignmentNote);
        } else if (!statusChanged && note != null) {
            createActivity(savedCase.getId(), AlertCaseActivityType.NOTE_ADDED, savedCase.getStatus(), savedCase.getStatus(), note);
        }

        return toResponse(alert, savedCase);
    }

    @Override
    public AlertResponse update(Long id, AlertRequest request) {
        Alert alert = findAlertOrThrow(id);
        Sensor sensor = null;
        if (request.getSensorId() != null) {
            sensor = findSensorOrThrow(request.getSensorId());
        }
        alert.setSensorId(request.getSensorId());
        alert.setCameraId(request.getCameraId());
        alert.setValue(request.getValue());
        alert.setAlert(Boolean.TRUE.equals(request.getIsAlert()));
        alert.setMessage(request.getMessage());
        alert.setTransformerId(request.getTransformerId());
        alert.setTransformerName(request.getTransformerName());
        alert.setTransformerCapacity(request.getTransformerCapacity());
        alert.setDepotId(request.getDepotId());
        alert.setDepotName(request.getDepotName());
        alert.setLat(request.getLat());
        alert.setLng(request.getLng());
        alert.setDevEui(request.getDevEui());
        alert.setDeviceId(request.getDeviceId());
        alert.setDeviceName(request.getDeviceName());
        alert.setSensorType(request.getSensorType());
        if (sensor != null) {
            alert.setSupplierCode(sensor.getSupplierCode());
            alert.setSupplierName(sensor.getSupplierName());
        } else if (accessScopeService.isSupplierScoped()) {
            alert.setSupplierCode(accessScopeService.getCurrentSupplierCode());
            alert.setSupplierName(accessScopeService.getCurrentSupplierName());
        }
        Alert saved = alertRepository.save(alert);
        return toResponse(saved, alertCaseRepository.findByAlertId(saved.getId()).orElse(null));
    }

    @Override
    public void delete(Long id) {
        Alert alert = findAlertOrThrow(id);
        alertCaseRepository.findByAlertId(alert.getId()).ifPresent(alertCase -> {
            alertCaseActivityRepository.deleteAllByAlertCaseId(alertCase.getId());
            alertCaseRepository.delete(alertCase);
        });
        alertRepository.delete(alert);
    }

    private Page<Alert> listScopedAlerts(Pageable pageable) {
        String supplierCode = accessScopeService.getCurrentSupplierCode();
        Long depotId = accessScopeService.getCurrentDepotId();
        if (supplierCode != null && depotId != null) {
            return alertRepository.findAllBySupplierCodeAndDepotIdOrderByCreatedAtDesc(supplierCode, depotId, pageable);
        }
        if (supplierCode != null) {
            return alertRepository.findAllBySupplierCodeOrderByCreatedAtDesc(supplierCode, pageable);
        }
        if (depotId != null) {
            return alertRepository.findAllByDepotIdOrderByCreatedAtDesc(depotId, pageable);
        }
        return alertRepository.findAllByOrderByCreatedAtDesc(pageable);
    }

    private Map<Long, AlertCase> loadCasesByAlertId(List<Alert> alerts) {
        List<Long> alertIds = alerts.stream()
                .map(Alert::getId)
                .filter(Objects::nonNull)
                .toList();
        if (alertIds.isEmpty()) {
            return Map.of();
        }
        return alertCaseRepository.findAllByAlertIdIn(alertIds).stream()
                .collect(Collectors.toMap(AlertCase::getAlertId, alertCase -> alertCase, (left, right) -> left, LinkedHashMap::new));
    }

    private Alert findAlertOrThrow(Long id) {
        Alert alert = alertRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alert with id " + id + " not found"));
        if (!isVisibleToCurrentUser(alert)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Alert with id " + id + " not found");
        }
        return alert;
    }

    private boolean isVisibleToCurrentUser(Alert alert) {
        if (alert == null) {
            return false;
        }
        String supplierCode = accessScopeService.getCurrentSupplierCode();
        if (supplierCode != null && !supplierCode.equalsIgnoreCase(String.valueOf(alert.getSupplierCode()))) {
            return false;
        }
        Long depotId = accessScopeService.getCurrentDepotId();
        return depotId == null || depotId.equals(alert.getDepotId());
    }

    private Sensor findSensorOrThrow(Long sensorId) {
        String supplierCode = accessScopeService.getCurrentSupplierCode();
        return (supplierCode != null
                ? sensorRepository.findByIdAndSupplierCode(sensorId, supplierCode)
                : sensorRepository.findById(sensorId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sensor with id " + sensorId + " not found"));
    }

    private AlertCase createInitialCase(Alert alert) {
        AlertCase alertCase = AlertCase.builder()
                .alertId(alert.getId())
                .status(Boolean.TRUE.equals(alert.isAlert()) ? AlertCaseStatus.NEW : AlertCaseStatus.RESOLVED)
                .lastActionAt(alert.getCreatedAt() != null ? alert.getCreatedAt() : LocalDateTime.now())
                .lastActionNote(Boolean.TRUE.equals(alert.isAlert()) ? "Alert case opened from incoming event" : "Informational event logged")
                .build();
        AlertCase savedCase = alertCaseRepository.save(alertCase);
        createActivity(
                savedCase.getId(),
                AlertCaseActivityType.CASE_CREATED,
                null,
                savedCase.getStatus(),
                savedCase.getLastActionNote()
        );
        return savedCase;
    }

    private void applyStatusTimestamp(AlertCase alertCase, AlertCaseStatus status, LocalDateTime timestamp) {
        switch (status) {
            case ACKNOWLEDGED -> alertCase.setAcknowledgedAt(timestamp);
            case DISPATCHED -> {
                alertCase.setAcknowledgedAt(alertCase.getAcknowledgedAt() != null ? alertCase.getAcknowledgedAt() : timestamp);
                alertCase.setDispatchedAt(timestamp);
            }
            case RESOLVED -> {
                alertCase.setAcknowledgedAt(alertCase.getAcknowledgedAt() != null ? alertCase.getAcknowledgedAt() : timestamp);
                alertCase.setResolvedAt(timestamp);
            }
            case FALSE_ALARM -> alertCase.setFalseAlarmAt(timestamp);
            case NEW -> {
            }
        }
    }

    private void createActivity(
            Long alertCaseId,
            AlertCaseActivityType activityType,
            AlertCaseStatus statusBefore,
            AlertCaseStatus statusAfter,
            String note
    ) {
        alertCaseActivityRepository.save(AlertCaseActivity.builder()
                .alertCaseId(alertCaseId)
                .activityType(activityType)
                .statusBefore(statusBefore)
                .statusAfter(statusAfter)
                .actorEmail(accessScopeService.getCurrentUserEmail())
                .actorName(accessScopeService.getCurrentUserEmail())
                .note(note)
                .build());
    }

    private AlertCaseActivityResponse toActivityResponse(AlertCaseActivity activity) {
        return AlertCaseActivityResponse.builder()
                .id(activity.getId())
                .activityType(activity.getActivityType())
                .statusBefore(activity.getStatusBefore())
                .statusAfter(activity.getStatusAfter())
                .actorEmail(activity.getActorEmail())
                .actorName(activity.getActorName())
                .note(activity.getNote())
                .createdAt(activity.getCreatedAt())
                .build();
    }

    private AlertResponse toResponse(Alert alert, AlertCase alertCase) {
        return AlertResponse.builder()
                .id(alert.getId())
                .sensorId(alert.getSensorId())
                .cameraId(alert.getCameraId())
                .value(alert.getValue())
                .isAlert(alert.isAlert())
                .message(alert.getMessage())
                .transformerId(alert.getTransformerId())
                .transformerName(alert.getTransformerName())
                .transformerCapacity(alert.getTransformerCapacity())
                .depotId(alert.getDepotId())
                .depotName(alert.getDepotName())
                .lat(alert.getLat())
                .lng(alert.getLng())
                .devEui(alert.getDevEui())
                .deviceId(alert.getDeviceId())
                .deviceName(alert.getDeviceName())
                .sensorType(alert.getSensorType())
                .supplierCode(alert.getSupplierCode())
                .supplierName(alert.getSupplierName())
                .imageUrl(alert.getImageUrl())
                .createdAt(alert.getCreatedAt())
                .updatedAt(alert.getUpdatedAt())
                .caseId(alertCase != null ? alertCase.getId() : null)
                .caseStatus(alertCase != null ? alertCase.getStatus() : null)
                .assignedToEmail(alertCase != null ? alertCase.getAssignedToEmail() : null)
                .assignedToName(alertCase != null ? alertCase.getAssignedToName() : null)
                .assignedAt(alertCase != null ? alertCase.getAssignedAt() : null)
                .acknowledgedAt(alertCase != null ? alertCase.getAcknowledgedAt() : null)
                .dispatchedAt(alertCase != null ? alertCase.getDispatchedAt() : null)
                .resolvedAt(alertCase != null ? alertCase.getResolvedAt() : null)
                .falseAlarmAt(alertCase != null ? alertCase.getFalseAlarmAt() : null)
                .lastActionAt(alertCase != null ? alertCase.getLastActionAt() : null)
                .lastActionByEmail(alertCase != null ? alertCase.getLastActionByEmail() : null)
                .lastActionByName(alertCase != null ? alertCase.getLastActionByName() : null)
                .lastActionNote(alertCase != null ? alertCase.getLastActionNote() : null)
                .build();
    }

    private String buildAssignmentNote(String assignedToName, String assignedToEmail, String note) {
        String assignee = trimToNull(assignedToName);
        if (assignee == null) {
            assignee = trimToNull(assignedToEmail);
        }
        if (assignee == null) {
            return note != null ? note : "Assignment cleared";
        }
        if (note != null) {
            return "Assigned to " + assignee + ". " + note;
        }
        return "Assigned to " + assignee;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private int compareCreatedAtDesc(LocalDateTime left, LocalDateTime right) {
        LocalDateTime leftValue = left != null ? left : LocalDateTime.MIN;
        LocalDateTime rightValue = right != null ? right : LocalDateTime.MIN;
        return rightValue.compareTo(leftValue);
    }
}
