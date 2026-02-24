package com.safalifter.transformerservice.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.safalifter.transformerservice.entities.Alert;
import com.safalifter.transformerservice.payload.request.AlertRequest;
import com.safalifter.transformerservice.payload.response.AlertResponse;
import com.safalifter.transformerservice.repository.AlertRepository;
import com.safalifter.transformerservice.repository.SensorRepository;
import com.safalifter.transformerservice.service.AlertService;

import java.util.List;

@Service
@Transactional
@RequiredArgsConstructor
public class AlertServiceImpl implements AlertService {

    private final AlertRepository alertRepository;
    private final SensorRepository sensorRepository;

    @Override
    public AlertResponse create(AlertRequest request) {
        sensorRepository.findById(request.getSensorId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sensor with id " + request.getSensorId() + " not found"));
        Alert alert = Alert.builder()
                .sensorId(request.getSensorId())
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
                .build();
        Alert saved = alertRepository.save(alert);
        return toResponse(saved);
    }

    @Override
    public AlertResponse getById(Long id) {
        Alert alert = alertRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alert with id " + id + " not found"));
        return toResponse(alert);
    }

    @Override
    public List<AlertResponse> getAll() {
        return alertRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Override
    public List<AlertResponse> listBySensorId(Long sensorId) {
        return alertRepository.findBySensorId(sensorId).stream().map(this::toResponse).toList();
    }

    @Override
    public AlertResponse update(Long id, AlertRequest request) {
        Alert alert = alertRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alert with id " + id + " not found"));
        sensorRepository.findById(request.getSensorId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sensor with id " + request.getSensorId() + " not found"));
        alert.setSensorId(request.getSensorId());
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
        Alert saved = alertRepository.save(alert);
        return toResponse(saved);
    }

    @Override
    public void delete(Long id) {
        Alert alert = alertRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alert with id " + id + " not found"));
        alertRepository.delete(alert);
    }

    private AlertResponse toResponse(Alert alert) {
        return AlertResponse.builder()
                .id(alert.getId())
                .sensorId(alert.getSensorId())
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
                .build();
    }
}