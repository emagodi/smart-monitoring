package com.safalifter.transformerservice.service.impl;

import com.safalifter.transformerservice.entities.Controller;
import com.safalifter.transformerservice.entities.ControllerReading;
import com.safalifter.transformerservice.entities.Transformer;
import com.safalifter.transformerservice.entities.TransformerType;
import com.safalifter.transformerservice.clients.NotificationClient;
import com.safalifter.transformerservice.payload.client.NotificationType;
import com.safalifter.transformerservice.payload.client.SendNotificationRequest;
import com.safalifter.transformerservice.payload.request.AlertRequest;
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

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.ArrayList;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class ControllerReadingServiceImpl implements ControllerReadingService {

    private final ControllerReadingRepository repository;
    private final ControllerRepository controllerRepository;
    private final TransformerRepository transformerRepository;
    private final AlertService alertService;
    private final NotificationClient notificationClient;
    private final ObjectMapper objectMapper;

    @Override
    public ControllerReading save(ControllerReading reading) {
        ControllerReading saved = repository.save(reading);
        processTriggers(saved);
        return saved;
    }

    private void processTriggers(ControllerReading reading) {
        if (!Boolean.TRUE.equals(reading.getDi1()) && !Boolean.TRUE.equals(reading.getDi2())) {
            return;
        }

        controllerRepository.findById(reading.getControllerId())
                .filter(controller -> controller.getTransformerId() != null)
                .ifPresent(controller -> transformerRepository.findById(controller.getTransformerId())
                        .ifPresent(transformer -> createAlert(transformer, controller, reading)));
    }

    private void createAlert(Transformer transformer, Controller controller, ControllerReading reading) {
        String triggerSummary = buildTriggerSummary(transformer.getType(), reading);
        AlertRequest alert = AlertRequest.builder()
                .transformerId(transformer.getId())
                .transformerName(transformer.getName())
                .transformerCapacity(transformer.getCapacity())
                .depotId(transformer.getDepotId())
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
        log.info("Creating controller trigger alert for transformer {} from controller {}", transformer.getId(), controller.getId());
        alertService.create(alert);
        try {
            notificationClient.send(SendNotificationRequest.builder()
                    .notificationType(NotificationType.CONTROLLER_TRIGGER)
                    .supplierCode(alert.getSupplierCode())
                    .sourceSystem("transformer-service")
                    .referenceId(reading.getId() != null ? String.valueOf(reading.getId()) : null)
                    .subject("Controller trigger detected")
                    .message(alert.getMessage())
                    .build());
        } catch (Exception ignored) {
        }
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
