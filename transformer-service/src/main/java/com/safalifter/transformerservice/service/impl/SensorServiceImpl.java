package com.safalifter.transformerservice.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.safalifter.transformerservice.entities.Sensor;
import com.safalifter.transformerservice.entities.Transformer;
import com.safalifter.transformerservice.payload.request.SensorRequest;
import com.safalifter.transformerservice.payload.response.SensorResponse;
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
    private final TransformerRepository transformerRepository;
    private final SensorReadingService sensorReadingService;

    @Override
    public SensorResponse create(SensorRequest request) {
        transformerRepository.findById(request.getTransformerId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer with id " + request.getTransformerId() + " not found"));
        sensorRepository.findByTransformerIdAndDeviceId(request.getTransformerId(), request.getDeviceId()).ifPresent(s -> { throw new ResponseStatusException(HttpStatus.CONFLICT, "Sensor already exists on transformer"); });
        Sensor sensor = Sensor.builder()
                .deviceId(request.getDeviceId())
                .devEui(request.getDevEui())
                .name(request.getName())
                .type(request.getType())
                .transformerId(request.getTransformerId())
                .build();
        Sensor saved = sensorRepository.save(sensor);
        return toResponse(saved);
    }

    @Override
    public SensorResponse getById(Long id) {
        Sensor sensor = sensorRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sensor with id " + id + " not found"));
        return toResponse(sensor);
    }

    @Override
    public SensorResponse getWithReadings(Long id) {
        Sensor sensor = sensorRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sensor with id " + id + " not found"));
        SensorResponse base = toResponse(sensor);
        base.setSensorReadings(sensorReadingService.listDetailedParsedBySensorId(sensor.getId()));
        return base;
    }

    @Override
    public List<SensorResponse> getAll() {
        return sensorRepository.findAll().stream()
                .map(s -> {
                    SensorResponse r = toResponse(s);
                    r.setSensorReadings(sensorReadingService.listDetailedParsedBySensorId(s.getId()));
                    return r;
                })
                .toList();
    }

    @Override
    public List<SensorResponse> listByTransformerId(Long transformerId) {
        return sensorRepository.findByTransformerId(transformerId).stream()
                .map(s -> {
                    SensorResponse r = toResponse(s);
                    r.setSensorReadings(sensorReadingService.listDetailedParsedBySensorId(s.getId()));
                    return r;
                })
                .toList();
    }

    @Override
    public SensorResponse update(Long id, SensorRequest request) {
        Sensor sensor = sensorRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sensor with id " + id + " not found"));
        transformerRepository.findById(request.getTransformerId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer with id " + request.getTransformerId() + " not found"));
        sensor.setDeviceId(request.getDeviceId());
        sensor.setDevEui(request.getDevEui());
        sensor.setName(request.getName());
        sensor.setType(request.getType());
        sensor.setTransformerId(request.getTransformerId());
        Sensor saved = sensorRepository.save(sensor);
        return toResponse(saved);
    }

    @Override
    public void delete(Long id) {
        Sensor sensor = sensorRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sensor with id " + id + " not found"));
        sensorRepository.delete(sensor);
    }

    private SensorResponse toResponse(Sensor sensor) {
        return SensorResponse.builder()
                .id(sensor.getId())
                .deviceId(sensor.getDeviceId())
                .devEui(sensor.getDevEui())
                .name(sensor.getName())
                .type(sensor.getType())
                .transformerId(sensor.getTransformerId())
                .build();
    }
}