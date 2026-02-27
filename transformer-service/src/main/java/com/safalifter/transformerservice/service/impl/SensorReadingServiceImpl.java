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
import com.safalifter.transformerservice.entities.Transformer;
import com.safalifter.transformerservice.payload.request.SensorReadingRequest;
import com.safalifter.transformerservice.payload.response.SensorReadingResponse;
import com.safalifter.transformerservice.payload.response.SensorValueResponse;
import com.safalifter.transformerservice.payload.response.SensorReadingDetailResponse;
import com.safalifter.transformerservice.repository.SensorReadingRepository;
import com.safalifter.transformerservice.repository.SensorRepository;
import com.safalifter.transformerservice.repository.TransformerRepository;
import com.safalifter.transformerservice.service.SensorReadingService;
import com.safalifter.transformerservice.service.AlertService;
import com.safalifter.transformerservice.payload.request.AlertRequest;
import com.safalifter.transformerservice.clients.NotificationClient;
import com.safalifter.transformerservice.payload.client.SendNotificationRequest;

import java.util.List;
import java.util.Map;

@Service
@Transactional
@RequiredArgsConstructor
public class SensorReadingServiceImpl implements SensorReadingService {

    private final SensorReadingRepository sensorReadingRepository;
    private final SensorRepository sensorRepository;
    private final AlertService alertService;
    private final TransformerRepository transformerRepository;
    private final NotificationClient notificationClient;
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
        processTriggers(saved);
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
    public List<SensorValueResponse> listBySensorIdAndDateRange(Long sensorId, java.time.LocalDateTime start, java.time.LocalDateTime end) {
        Sensor sensor = sensorRepository.findById(sensorId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sensor with id " + sensorId + " not found"));
        String type = sensor.getType();
        // Try to filter by updatedAt first, as it's the primary timestamp we use
        List<SensorReading> readings = sensorReadingRepository.findBySensorIdAndUpdatedAtBetween(sensorId, start, end);
        if (readings.isEmpty()) {
             // Fallback to createdAt if needed, or maybe just return empty
             // For now let's also check createdAt if updatedAt didn't yield results, 
             // but usually we should stick to one field. 
             // Given the previous requirement "use updated at", let's stick to updatedAt.
             // However, some records might only have createdAt if they were never updated.
             // Let's use a custom query or just filter in memory if we want to be robust, 
             // but repository method is cleaner. 
             // Let's assume consistent usage of updatedAt for now as per previous fix.
        }
        return readings.stream()
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
        processTriggers(saved);
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
        String timestamp = null;
        if (reading.getUpdatedAt() != null) {
            timestamp = reading.getUpdatedAt().toString();
            if (!timestamp.contains("T")) {
                timestamp = timestamp.replace(" ", "T");
            }
        } else if (reading.getCreatedAt() != null) {
            timestamp = reading.getCreatedAt().toString();
            if (!timestamp.contains("T")) {
                timestamp = timestamp.replace(" ", "T");
            }
        }
        return SensorValueResponse.builder()
                .id(reading.getId())
                .type(type)
                .value(valueObj != null ? String.valueOf(valueObj) : null)
                .timestamp(timestamp)
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
        // 1. Try raw_payload structure: decoded.data.{key}
        try {
            if (reading.getRawPayload() != null && !reading.getRawPayload().isBlank()) {
                Map<String,Object> m = objectMapper.readValue(reading.getRawPayload(), new TypeReference<Map<String,Object>>(){});
                Object decoded = m.get("decoded");
                if (decoded instanceof Map<?,?> dm) {
                    Object data = dm.get("data");
                    if (data instanceof Map<?,?> ddm) {
                        Object v = findValue(ddm, key);
                        if (v != null) return normalizeValue(key, v);
                    }
                     // Fallback: try direct access in decoded map
                    Object v = findValue((Map<?,?>)dm, key);
                    if (v != null) return normalizeValue(key, v);
                }
            }
        } catch (Exception ignored) {}

        // 2. Try decoded structure: data.{key} or direct {key}
        try {
            if (reading.getDecoded() != null && !reading.getDecoded().isBlank()) {
                Map<String,Object> m = objectMapper.readValue(reading.getDecoded(), new TypeReference<Map<String,Object>>(){});
                Object data = m.get("data");
                if (data instanceof Map<?,?> ddm) {
                    Object v = findValue(ddm, key);
                    if (v != null) return normalizeValue(key, v);
                }
                // Fallback: direct access
                Object v = findValue(m, key);
                if (v != null) return normalizeValue(key, v);
            }
        } catch (Exception ignored) {}
        return null;
    }

    private Object findValue(Map<?,?> map, String key) {
        if (map.containsKey(key)) return map.get(key);
        // Try simple variations
        if (map.containsKey(key.toLowerCase())) return map.get(key.toLowerCase());
        if (map.containsKey(key.toUpperCase())) return map.get(key.toUpperCase());
        // Try common aliases
        if ("temperature".equals(key) && map.containsKey("temp")) return map.get("temp");
        if ("temperature".equals(key) && map.containsKey("Temp")) return map.get("Temp");
        return null;
    }

    private Object normalizeValue(String type, Object v) {
        if ("contact".equalsIgnoreCase(type)) {
            if (v instanceof Number n) {
                return n.intValue() == 0 ? "closed" : "open";
            }
        }
        return v;
    }

    private String canonicalType(String type) {
        if (type == null || type.isBlank()) return "temperature";
        String t = type.toLowerCase();
        if (t.contains("temp")) return "temperature";
        if (t.contains("contact")) return "contact";
        if (t.contains("motion")) return "motion";
        if (t.contains("tilt")) return "tilt";
        if (t.contains("suspicious")) return "suspicious_till";
        return t;
    }

    private Object normalizeContact(String type, Object val) {
        if ("contact".equalsIgnoreCase(type)) {
            if (val instanceof Number n) {
                return n.intValue() == 0 ? "closed" : "open";
            }
            String s = String.valueOf(val).toLowerCase();
            if ("0".equals(s) || "false".equals(s) || "closed".equals(s)) return "closed";
            if ("1".equals(s) || "true".equals(s) || "open".equals(s)) return "open";
        }
        return val;
    }

    public void processTriggers(SensorReading reading) {
        Sensor sensor = sensorRepository.findById(reading.getSensorId()).orElse(null);
        if (sensor == null) return;
        String type = canonicalType(sensor.getType());
        Object val = extractValue(reading, type);
        if (val == null) return;
        boolean trigger = false;
        String message;
        if ("contact".equals(type)) {
            String v = String.valueOf(normalizeContact(type, val));
            trigger = "open".equalsIgnoreCase(v);
            message = sensor.getName() + " contact " + v;
        } else if ("temperature".equals(type)) {
            double d;
            try { d = Double.parseDouble(String.valueOf(val)); } catch (Exception e) { d = Double.NaN; }
            trigger = !Double.isNaN(d) && d >= 20.0;
            message = sensor.getName() + " temperature " + String.valueOf(val);
        } else if ("suspicious_till".equals(type)) {
            String v = String.valueOf(val);
            boolean b = "true".equalsIgnoreCase(v) || "1".equals(v);
            trigger = b;
            message = sensor.getName() + " suspicious_till " + v;
        } else {
            return;
        }
        if (trigger) {
            Transformer tf = null;
            try {
                if (sensor.getTransformerId() != null) {
                    tf = transformerRepository.findById(sensor.getTransformerId()).orElse(null);
                }
            } catch (Exception ignored) {}
            AlertRequest ar = AlertRequest.builder()
                    .sensorId(sensor.getId())
                    .value(String.valueOf(val))
                    .isAlert(true)
                    .message(message)
                    .transformerId(sensor.getTransformerId())
                    .transformerName(tf != null ? tf.getName() : null)
                    .transformerCapacity(tf != null ? tf.getCapacity() : null)
                    .depotId(tf != null ? tf.getDepotId() : null)
                    .lat(tf != null ? tf.getLat() : null)
                    .lng(tf != null ? tf.getLng() : null)
                    .devEui(sensor.getDevEui())
                    .deviceId(sensor.getDeviceId())
                    .deviceName(sensor.getName())
                    .sensorType(sensor.getType())
                    .build();
            try { alertService.create(ar); } catch (Exception ignored) {}
        }
    }
}