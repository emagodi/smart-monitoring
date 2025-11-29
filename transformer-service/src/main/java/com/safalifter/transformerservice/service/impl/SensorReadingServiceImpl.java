package com.safalifter.transformerservice.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.safalifter.transformerservice.entities.SensorReading;
import com.safalifter.transformerservice.payload.request.SensorReadingRequest;
import com.safalifter.transformerservice.payload.response.SensorReadingResponse;
import com.safalifter.transformerservice.repository.SensorReadingRepository;
import com.safalifter.transformerservice.repository.SensorRepository;
import com.safalifter.transformerservice.service.SensorReadingService;

import java.util.List;

@Service
@Transactional
@RequiredArgsConstructor
public class SensorReadingServiceImpl implements SensorReadingService {

    private final SensorReadingRepository sensorReadingRepository;
    private final SensorRepository sensorRepository;

    @Override
    public SensorReadingResponse create(SensorReadingRequest request) {
        sensorRepository.findById(request.getSensorId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sensor with id " + request.getSensorId() + " not found"));
        SensorReading reading = SensorReading.builder()
                .sensorId(request.getSensorId())
                .rawPayload(request.getRawPayload())
                .decoded(request.getDecoded())
                .build();
        SensorReading saved = sensorReadingRepository.save(reading);
        return toResponse(saved);
    }

    @Override
    public SensorReadingResponse getById(Long id) {
        SensorReading reading = sensorReadingRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sensor reading with id " + id + " not found"));
        return toResponse(reading);
    }

    @Override
    public List<SensorReadingResponse> getAll() {
        return sensorReadingRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Override
    public List<SensorReadingResponse> listBySensorId(Long sensorId) {
        return sensorReadingRepository.findBySensorId(sensorId).stream().map(this::toResponse).toList();
    }

    @Override
    public SensorReadingResponse update(Long id, SensorReadingRequest request) {
        SensorReading reading = sensorReadingRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sensor reading with id " + id + " not found"));
        sensorRepository.findById(request.getSensorId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sensor with id " + request.getSensorId() + " not found"));
        reading.setSensorId(request.getSensorId());
        reading.setRawPayload(request.getRawPayload());
        reading.setDecoded(request.getDecoded());
        SensorReading saved = sensorReadingRepository.save(reading);
        return toResponse(saved);
    }

    @Override
    public void delete(Long id) {
        SensorReading reading = sensorReadingRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sensor reading with id " + id + " not found"));
        sensorReadingRepository.delete(reading);
    }

    private SensorReadingResponse toResponse(SensorReading reading) {
        return SensorReadingResponse.builder()
                .id(reading.getId())
                .sensorId(reading.getSensorId())
                .rawPayload(reading.getRawPayload())
                .decoded(reading.getDecoded())
                .build();
    }
}