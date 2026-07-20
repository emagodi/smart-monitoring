package com.safalifter.transformerservice.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.safalifter.transformerservice.config.AccessScopeService;
import com.safalifter.transformerservice.entities.Sensor;
import com.safalifter.transformerservice.entities.Transformer;
import com.safalifter.transformerservice.payload.request.SensorRequest;
import com.safalifter.transformerservice.payload.response.SensorResponse;
import com.safalifter.transformerservice.repository.ControllerRepository;
import com.safalifter.transformerservice.repository.SensorRepository;
import com.safalifter.transformerservice.repository.TransformerRepository;
import com.safalifter.transformerservice.service.SensorService;
import com.safalifter.transformerservice.service.SensorReadingService;

import java.util.List;

@Service
@Transactional
@RequiredArgsConstructor
public class SensorServiceImpl implements SensorService {

    private final SensorRepository sensorRepository;
    private final ControllerRepository controllerRepository;
    private final TransformerRepository transformerRepository;
    private final SensorReadingService sensorReadingService;
    private final AccessScopeService accessScopeService;

    @Override
    public SensorResponse create(SensorRequest request) {
        Transformer transformer = findAssignmentTransformerOrThrow(request.getTransformerId());
        sensorRepository.findByTransformerIdAndDeviceId(request.getTransformerId(), request.getDeviceId()).ifPresent(s -> { throw new ResponseStatusException(HttpStatus.CONFLICT, "Sensor already exists on transformer"); });
        Sensor sensor = Sensor.builder()
                .deviceId(request.getDeviceId())
                .devEui(request.getDevEui())
                .name(request.getName())
                .type(request.getType())
                .supplierCode(resolveSupplierCode(transformer, null))
                .supplierName(resolveSupplierName(transformer, null))
                .transformerId(request.getTransformerId())
                .build();
        Sensor saved = sensorRepository.save(sensor);
        return toResponse(saved);
    }

    @Override
    public SensorResponse getById(Long id) {
        Sensor sensor = findSensorOrThrow(id);
        return toResponse(sensor);
    }

    @Override
    public SensorResponse getWithReadings(Long id) {
        Sensor sensor = findSensorOrThrow(id);
        SensorResponse base = toResponse(sensor);
        base.setSensorReadings(sensorReadingService.listDetailedParsedBySensorId(sensor.getId()));
        return base;
    }

    @Override
    public List<SensorResponse> getAll() {
        String supplierCode = accessScopeService.getCurrentSupplierCode();
        List<Sensor> sensors = supplierCode != null ? sensorRepository.findAllBySupplierCode(supplierCode) : sensorRepository.findAll();
        return sensors.stream()
                .map(s -> {
                    SensorResponse r = toResponse(s);
                    r.setSensorReadings(sensorReadingService.listDetailedParsedBySensorId(s.getId()));
                    return r;
                })
                .toList();
    }

    @Override
    public List<SensorResponse> listByTransformerId(Long transformerId) {
        findTransformerOrThrow(transformerId);
        String supplierCode = accessScopeService.getCurrentSupplierCode();
        List<Sensor> sensors = supplierCode != null
                ? sensorRepository.findByTransformerIdAndSupplierCode(transformerId, supplierCode)
                : sensorRepository.findByTransformerId(transformerId);
        return sensors.stream()
                .map(s -> {
                    SensorResponse r = toResponse(s);
                    r.setSensorReadings(sensorReadingService.listDetailedParsedBySensorId(s.getId()));
                    return r;
                })
                .toList();
    }

    @Override
    public SensorResponse update(Long id, SensorRequest request) {
        Sensor sensor = findSensorOrThrow(id);
        Transformer transformer = findAssignmentTransformerOrThrow(request.getTransformerId());
        sensor.setDeviceId(request.getDeviceId());
        sensor.setDevEui(request.getDevEui());
        sensor.setName(request.getName());
        sensor.setType(request.getType());
        sensor.setTransformerId(request.getTransformerId());
        sensor.setSupplierCode(resolveSupplierCode(transformer, sensor.getSupplierCode()));
        sensor.setSupplierName(resolveSupplierName(transformer, sensor.getSupplierName()));
        Sensor saved = sensorRepository.save(sensor);
        return toResponse(saved);
    }

    @Override
    public void delete(Long id) {
        Sensor sensor = findSensorOrThrow(id);
        sensorRepository.delete(sensor);
    }

    private Sensor findSensorOrThrow(Long id) {
        String supplierCode = accessScopeService.getCurrentSupplierCode();
        return (supplierCode != null
                ? sensorRepository.findByIdAndSupplierCode(id, supplierCode)
                : sensorRepository.findById(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sensor with id " + id + " not found"));
    }

    private Transformer findTransformerOrThrow(Long transformerId) {
        String supplierCode = accessScopeService.getCurrentSupplierCode();
        return (supplierCode != null
                ? transformerRepository.findById(transformerId)
                    .filter(transformer -> isVisibleToSupplier(transformer, supplierCode))
                : transformerRepository.findById(transformerId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer with id " + transformerId + " not found"));
    }

    private boolean isVisibleToSupplier(Transformer transformer, String supplierCode) {
        if (transformer == null) {
            return false;
        }
        if (supplierCode.equalsIgnoreCase(String.valueOf(transformer.getSupplierCode()))) {
            return true;
        }
        return controllerRepository.findByTransformerIdAndSupplierCode(transformer.getId(), supplierCode).stream().findAny().isPresent()
                || sensorRepository.findByTransformerIdAndSupplierCode(transformer.getId(), supplierCode).stream().findAny().isPresent();
    }

    private Transformer findAssignmentTransformerOrThrow(Long transformerId) {
        return transformerRepository.findById(transformerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer with id " + transformerId + " not found"));
    }

    private String resolveSupplierCode(Transformer transformer, String existingSupplierCode) {
        if (accessScopeService.isSupplierScoped()) {
            return accessScopeService.getCurrentSupplierCode();
        }
        if (transformer != null && transformer.getSupplierCode() != null && !transformer.getSupplierCode().isBlank()) {
            return transformer.getSupplierCode();
        }
        return existingSupplierCode;
    }

    private String resolveSupplierName(Transformer transformer, String existingSupplierName) {
        if (accessScopeService.isSupplierScoped()) {
            return accessScopeService.getCurrentSupplierName();
        }
        if (transformer != null && transformer.getSupplierName() != null && !transformer.getSupplierName().isBlank()) {
            return transformer.getSupplierName();
        }
        return existingSupplierName;
    }

    private SensorResponse toResponse(Sensor sensor) {
        return SensorResponse.builder()
                .id(sensor.getId())
                .deviceId(sensor.getDeviceId())
                .devEui(sensor.getDevEui())
                .name(sensor.getName())
                .type(sensor.getType())
                .supplierCode(sensor.getSupplierCode())
                .supplierName(sensor.getSupplierName())
                .transformerId(sensor.getTransformerId())
                .build();
    }
}
