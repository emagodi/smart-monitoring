package com.safalifter.transformerservice.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.safalifter.transformerservice.entities.SensorReading;
import com.safalifter.transformerservice.entities.Sensor;
import com.safalifter.transformerservice.payload.request.SensorReadingRequest;
import com.safalifter.transformerservice.payload.response.SensorReadingResponse;
import com.safalifter.transformerservice.payload.response.SensorValueResponse;
import com.safalifter.transformerservice.payload.response.SensorReadingDetailResponse;
import com.safalifter.transformerservice.repository.SensorReadingRepository;
import com.safalifter.transformerservice.repository.SensorRepository;
import com.safalifter.transformerservice.service.SensorReadingService;

import java.util.List;
import java.util.Map;

@Service
@Transactional
@RequiredArgsConstructor
public class SensorReadingServiceImpl implements SensorReadingService {

    private final SensorReadingRepository sensorReadingRepository;
    private final SensorRepository sensorRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

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
    public List<SensorValueResponse> listBySensorId(Long sensorId) {
        Sensor sensor = sensorRepository.findById(sensorId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sensor with id " + sensorId + " not found"));
        String type = sensor.getType();
        return sensorReadingRepository.findBySensorId(sensorId).stream()
                .map(r -> toParsedValueResponse(r, type))
                .toList();
    }

    @Override
    public List<SensorValueResponse> listParsedValuesBySensorId(Long sensorId) {
        Sensor sensor = sensorRepository.findById(sensorId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sensor with id " + sensorId + " not found"));
        String type = sensor.getType();
        return sensorReadingRepository.findBySensorId(sensorId).stream()
                .map(r -> toParsedValueResponse(r, type))
                .toList();
    }

    @Override
    public List<SensorReadingDetailResponse> listDetailedParsedBySensorId(Long sensorId) {
        Sensor sensor = sensorRepository.findById(sensorId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sensor with id " + sensorId + " not found"));
        String type = sensor.getType();
        return sensorReadingRepository.findBySensorId(sensorId).stream()
                .map(r -> toDetailedParsedResponse(r, type))
                .toList();
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

    private SensorValueResponse toParsedValueResponse(SensorReading reading, String type) {
        Object valueObj = extractValue(reading, type);
        return SensorValueResponse.builder()
                .id(0)
                .type(type)
                .value(valueObj != null ? String.valueOf(valueObj) : null)
                .build();
    }

    private SensorReadingDetailResponse toDetailedParsedResponse(SensorReading reading, String type) {
        String key = canonicalType(type);
        Object value = extractValue(reading, key);
        java.util.HashMap<String, Object> attrs = new java.util.HashMap<>();
        if (value != null) {
            attrs.put(key, value);
        }
        return SensorReadingDetailResponse.builder()
                .id(reading.getId())
                .sensorId(reading.getSensorId())
                .createdAt(reading.getCreatedAt() != null ? reading.getCreatedAt().toString() : null)
                .updatedAt(reading.getUpdatedAt() != null ? reading.getUpdatedAt().toString() : null)
                .attributes(attrs)
                .build();
    }

    private Object extractValue(SensorReading reading, String type) {
        String key = canonicalType(type);
        // Prefer raw_payload structure decoded.data.{type}
        try {
            if (reading.getRawPayload() != null && !reading.getRawPayload().isBlank()) {
                Map<String,Object> m = objectMapper.readValue(reading.getRawPayload(), new TypeReference<Map<String,Object>>(){});
                Object decoded = m.get("decoded");
                if (decoded instanceof Map<?,?> dm) {
                    Object data = dm.get("data");
                    if (data instanceof Map<?,?> ddm) {
                        Object v = ddm.get(key);
                        if (v != null) return normalizeContact(key, v);
                    }
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    private Object normalizeContact(String type, Object v) {
        if (!"contact".equalsIgnoreCase(type)) return v;
        if (v instanceof Number n) {
            return n.intValue() == 0 ? "closed" : "open";
        }
        return String.valueOf(v);
    }

    private String canonicalType(String type) {
        if (type == null || type.isBlank()) return "temperature";
        String t = type.toLowerCase();
        if (t.contains("temp")) return "temperature";
        if (t.contains("contact")) return "contact";
        return t;
    }
}