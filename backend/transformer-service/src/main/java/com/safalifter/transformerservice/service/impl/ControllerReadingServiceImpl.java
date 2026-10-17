package com.safalifter.transformerservice.service.impl;

import com.safalifter.transformerservice.entities.Controller;
import com.safalifter.transformerservice.entities.ControllerReading;
import com.safalifter.transformerservice.entities.Transformer;
import com.safalifter.transformerservice.entities.TransformerType;
import com.safalifter.transformerservice.clients.NotificationClient;
import com.safalifter.transformerservice.payload.client.NotificationType;
import com.safalifter.transformerservice.payload.client.SendNotificationRequest;
import com.safalifter.transformerservice.payload.request.AlertRequest;
import com.safalifter.transformerservice.payload.response.AlertRaiseResult;
import com.safalifter.transformerservice.payload.response.AlertResponse;
import com.safalifter.transformerservice.payload.response.ControllerReadingDetailResponse;
import com.safalifter.transformerservice.repository.ControllerReadingRepository;
import com.safalifter.transformerservice.repository.ControllerRepository;
import com.safalifter.transformerservice.repository.TransformerRepository;
import com.safalifter.transformerservice.service.AlertService;
import com.safalifter.transformerservice.service.ControllerReadingService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.ArrayList;
import java.util.Locale;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class ControllerReadingServiceImpl implements ControllerReadingService {
    private static final DateTimeFormatter ALERT_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final ControllerReadingRepository repository;
    private final ControllerRepository controllerRepository;
    private final TransformerRepository transformerRepository;
    private final AlertService alertService;
    private final NotificationClient notificationClient;
    private final ObjectMapper objectMapper;

    @Override
    public ControllerReading save(ControllerReading reading) {
        ControllerReading saved = repository.save(reading);
        Controller controller = saved.getControllerId() != null
                ? controllerRepository.findById(saved.getControllerId()).orElse(null)
                : null;
        // Capture the previous DI state BEFORE the denormalised columns are overwritten,
        // so triggers can be edge-detected (false -> true) instead of level-detected.
        Boolean previousDi1 = controller != null ? controller.getLastReadingDi1() : null;
        Boolean previousDi2 = controller != null ? controller.getLastReadingDi2() : null;
        updateControllerDenormFromReading(saved, controller);
        processTriggers(saved, controller, previousDi1, previousDi2);
        return saved;
    }

    private void updateControllerDenormFromReading(ControllerReading reading, Controller controller) {
        if (reading == null || controller == null) return;
        try {
            controller.setLastReadingAt(reading.getCreatedAt() != null ? reading.getCreatedAt() : LocalDateTime.now());
            controller.setLastReadingDi1(reading.getDi1());
            controller.setLastReadingDi2(reading.getDi2());
            controller.setLastReadingBattery(reading.getBattery());
            controller.setLastReadingRssi(reading.getRssi());
            controller.setLastReadingSnr(reading.getSnr());
            controller.setLastReadingDecodedPayload(reading.getDecodedPayload());
            controllerRepository.save(controller);

            if (controller.getTransformerId() != null) {
                transformerRepository.findById(controller.getTransformerId()).ifPresent(transformer -> {
                    LocalDateTime readingTs = reading.getCreatedAt() != null ? reading.getCreatedAt() : LocalDateTime.now();
                    if (transformer.getLastTelemetryAt() == null || readingTs.isAfter(transformer.getLastTelemetryAt())) {
                        transformer.setLastTelemetryAt(readingTs);
                        transformerRepository.save(transformer);
                    }
                });
            }
        } catch (Exception e) {
            log.warn("Denorm update failed for reading controller={}: {}", reading.getControllerId(), e.getMessage());
        }
    }

    /**
     * Raise an alert only when an input goes from not-triggered to triggered.
     *
     * Devices report the DI level on every uplink. A door left open or a motion input held
     * high used to create a new alert + case + activity + WhatsApp/email on EVERY uplink,
     * which is what filled the alerts table with millions of rows. Repeats while the input
     * stays high are now ignored; new edges while a case is still open are folded into that
     * case by AlertService#raise.
     */
    private void processTriggers(ControllerReading reading, Controller controller, Boolean previousDi1, Boolean previousDi2) {
        boolean di1Rising = Boolean.TRUE.equals(reading.getDi1()) && !Boolean.TRUE.equals(previousDi1);
        boolean di2Rising = Boolean.TRUE.equals(reading.getDi2()) && !Boolean.TRUE.equals(previousDi2);
        if (!di1Rising && !di2Rising) {
            return;
        }
        if (controller == null || controller.getTransformerId() == null) {
            return;
        }
        transformerRepository.findById(controller.getTransformerId())
                .ifPresent(transformer -> createAlert(transformer, controller, reading));
    }

    private void createAlert(Transformer transformer, Controller controller, ControllerReading reading) {
        String triggerSummary = buildTriggerSummary(transformer.getType(), reading);
        AlertRequest alert = AlertRequest.builder()
                .transformerId(transformer.getId())
                .transformerName(transformer.getName())
                .transformerNumber(transformer.getTransformerNumber())
                .depotId(transformer.getDepotId())
                .depotName(resolveAlertLocation(transformer))
                .lat(transformer.getLat())
                .lng(transformer.getLng())
                .deviceId(controller.getDeviceId())
                .deviceName(controller.getName())
                .sensorType("CONTROLLER_TRIGGER")
                .supplierCode(transformer.getSupplierCode() != null ? transformer.getSupplierCode() : controller.getSupplierCode())
                .supplierName(transformer.getSupplierName() != null ? transformer.getSupplierName() : controller.getSupplierName())
                .isAlert(true)
                .value(triggerSummary)
                .message("Controller trigger detected on " + transformer.getName() + " (" + resolveTransformerTypeLabel(transformer.getType()) + ": " + triggerSummary + ")")
                .build();
        AlertRaiseResult result = alertService.raise(alert);
        AlertResponse raised = result.getAlert();
        if (result.isCreated()) {
            log.info("Created controller trigger alert {} for transformer {} from controller {}",
                    raised.getId(), transformer.getId(), controller.getId());
        }
        if (!result.isShouldNotify()) {
            return;
        }
        int occurrences = raised.getOccurrenceCount() != null ? raised.getOccurrenceCount() : 1;
        String subject = result.isCreated()
                ? "Controller trigger detected"
                : "Controller trigger repeated (" + occurrences + " events, case still open)";
        try {
            notificationClient.send(SendNotificationRequest.builder()
                    .notificationType(NotificationType.CONTROLLER_TRIGGER)
                    .supplierCode(alert.getSupplierCode())
                    .depotId(alert.getDepotId())
                    .sourceSystem("transformer-service")
                    .referenceId(raised.getId() != null ? String.valueOf(raised.getId()) : null)
                    .subject(subject)
                    .message(alert.getMessage())
                    .whatsappTemplateParameters(buildSecurityAlertTemplateParameters(transformer, triggerSummary, reading.getCreatedAt()))
                    .build());
        } catch (Exception ignored) {
        }
    }

    private List<String> buildSecurityAlertTemplateParameters(Transformer transformer, String triggerSummary, LocalDateTime detectedAt) {
        return List.of(
                resolveTransformerLabel(transformer),
                triggerSummary == null || triggerSummary.isBlank() ? "Security event detected" : triggerSummary,
                resolveAlertLocation(transformer),
                formatAlertTime(detectedAt)
        );
    }

    private String resolveTransformerLabel(Transformer transformer) {
        if (transformer == null || transformer.getName() == null || transformer.getName().isBlank()) {
            return "Unknown transformer";
        }
        return transformer.getName().trim();
    }

    private String resolveAlertLocation(Transformer transformer) {
        if (transformer == null) {
            return "Unknown location";
        }
        if (transformer.getDepotId() != null) {
            return "Depot " + transformer.getDepotId();
        }
        if (transformer.getSupplierName() != null && !transformer.getSupplierName().isBlank()) {
            return transformer.getSupplierName().trim();
        }
        if (transformer.getSupplierCode() != null && !transformer.getSupplierCode().isBlank()) {
            return transformer.getSupplierCode().trim().toUpperCase(Locale.ROOT);
        }
        return "Unknown location";
    }

    private String formatAlertTime(LocalDateTime detectedAt) {
        LocalDateTime effectiveTime = detectedAt != null ? detectedAt : LocalDateTime.now();
        return ALERT_TIME_FORMATTER.format(effectiveTime);
    }

    private String buildTriggerSummary(TransformerType transformerType, ControllerReading reading) {
        List<String> activeSignals = new ArrayList<>();
        if (Boolean.TRUE.equals(reading.getDi1())) {
            activeSignals.add("Motion Detected");
        }
        if (Boolean.TRUE.equals(reading.getDi2())) {
            if (transformerType == TransformerType.GROUND_MOUNTED) {
                activeSignals.add("Door Open");
            } else if (transformerType == TransformerType.POLE_MOUNTED) {
                activeSignals.add("Vibration Detected");
            } else {
                activeSignals.add("Secondary Trigger Detected");
            }
        }
        return activeSignals.isEmpty() ? "Trigger Cleared" : String.join(", ", activeSignals);
    }

    private String resolveTransformerTypeLabel(TransformerType transformerType) {
        if (transformerType == TransformerType.GROUND_MOUNTED) {
            return "GMT";
        }
        if (transformerType == TransformerType.POLE_MOUNTED) {
            return "PMT";
        }
        return "Unspecified";
    }

    @Override
    public List<ControllerReading> getByControllerId(Long controllerId) {
        return repository.findByControllerId(controllerId);
    }

    @Override
    public Page<ControllerReading> getByControllerId(Long controllerId, Pageable pageable) {
        return repository.findByControllerId(controllerId, pageable);
    }

    @Override
    public List<ControllerReading> getByControllerIdAndDateRange(Long controllerId, java.time.LocalDateTime start, java.time.LocalDateTime end) {
        return repository.findByControllerIdAndCreatedAtBetween(controllerId, start, end);
    }

    @Override
    public Page<ControllerReading> getByControllerIdAndDateRange(Long controllerId, java.time.LocalDateTime start, java.time.LocalDateTime end, Pageable pageable) {
        return repository.findByControllerIdAndCreatedAtBetween(controllerId, start, end, pageable);
    }

    @Override
    public Page<ControllerReadingDetailResponse> getDetailedByControllerId(Long controllerId, Pageable pageable) {
        return repository.findByControllerId(controllerId, pageable).map(this::toDetailedResponse);
    }

    @Override
    public Page<ControllerReadingDetailResponse> getDetailedByControllerIdAndDateRange(Long controllerId, java.time.LocalDateTime start, java.time.LocalDateTime end, Pageable pageable) {
        return repository.findByControllerIdAndCreatedAtBetween(controllerId, start, end, pageable).map(this::toDetailedResponse);
    }

    private ControllerReadingDetailResponse toDetailedResponse(ControllerReading reading) {
        return ControllerReadingDetailResponse.builder()
                .id(reading.getId())
                .controllerId(reading.getControllerId())
                .createdAt(reading.getCreatedAt() != null ? reading.getCreatedAt().toString() : null)
                .updatedAt(reading.getUpdatedAt() != null ? reading.getUpdatedAt().toString() : null)
                .rawPayload(reading.getRawPayload())
                .decodedPayload(reading.getDecodedPayload())
                .attributes(buildAttributes(reading))
                .build();
    }

    private Map<String, Object> buildAttributes(ControllerReading reading) {
        Map<String, Object> attrs = new LinkedHashMap<>();
        mergeIfPresent(attrs, parseJson(reading.getDecodedPayload()));
        if (attrs.isEmpty()) {
            mergeIfPresent(attrs, parseJson(reading.getRawPayload()));
        }
        if (reading.getDi1() != null) {
            attrs.putIfAbsent("di1", reading.getDi1());
        }
        if (reading.getDi2() != null) {
            attrs.putIfAbsent("di2", reading.getDi2());
        }
        if (reading.getBattery() != null) {
            attrs.putIfAbsent("battery", reading.getBattery());
        }
        if (reading.getRssi() != null) {
            attrs.putIfAbsent("rssi", reading.getRssi());
        }
        if (reading.getSnr() != null) {
            attrs.putIfAbsent("snr", reading.getSnr());
        }
        return attrs;
    }

    private Map<String, Object> parseJson(String payload) {
        if (payload == null || payload.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(payload, new TypeReference<Map<String, Object>>() {});
        } catch (Exception ignored) {
            return Map.of();
        }
    }

    private void mergeIfPresent(Map<String, Object> target, Map<String, Object> source) {
        if (source == null || source.isEmpty()) {
            return;
        }
        source.forEach(target::putIfAbsent);
    }
}
