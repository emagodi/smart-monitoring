package com.safalifter.transformerservice.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.safalifter.transformerservice.config.AccessScopeService;
import com.safalifter.transformerservice.entities.Alert;
import com.safalifter.transformerservice.entities.Sensor;
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
        return toResponse(saved);
    }

    @Override
    public AlertResponse getById(Long id) {
        Alert alert = findAlertOrThrow(id);
        return toResponse(alert);
    }

    @Override
    public List<AlertResponse> getAll() {
        String supplierCode = accessScopeService.getCurrentSupplierCode();
        List<Alert> alerts = supplierCode != null ? alertRepository.findAllBySupplierCode(supplierCode) : alertRepository.findAll();
        return alerts.stream().map(this::toResponse).toList();
    }

    @Override
    public List<AlertResponse> listBySensorId(Long sensorId) {
        if (accessScopeService.isSupplierScoped()) {
            return alertRepository.findBySensorIdAndSupplierCode(sensorId, accessScopeService.getCurrentSupplierCode()).stream().map(this::toResponse).toList();
        }
        return alertRepository.findBySensorId(sensorId).stream().map(this::toResponse).toList();
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
        return toResponse(saved);
    }

    @Override
    public void delete(Long id) {
        Alert alert = findAlertOrThrow(id);
        alertRepository.delete(alert);
    }

    private Alert findAlertOrThrow(Long id) {
        String supplierCode = accessScopeService.getCurrentSupplierCode();
        return (supplierCode != null
                ? alertRepository.findByIdAndSupplierCode(id, supplierCode)
                : alertRepository.findById(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alert with id " + id + " not found"));
    }

    private Sensor findSensorOrThrow(Long sensorId) {
        String supplierCode = accessScopeService.getCurrentSupplierCode();
        return (supplierCode != null
                ? sensorRepository.findByIdAndSupplierCode(sensorId, supplierCode)
                : sensorRepository.findById(sensorId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sensor with id " + sensorId + " not found"));
    }

    private AlertResponse toResponse(Alert alert) {
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
                .build();
    }
}
