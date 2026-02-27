package com.safalifter.transformerservice.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safalifter.transformerservice.entities.Camera;
import com.safalifter.transformerservice.entities.Sensor;
import com.safalifter.transformerservice.entities.SensorReading;
import com.safalifter.transformerservice.entities.Transformer;
import com.safalifter.transformerservice.payload.request.AlertRequest;
import com.safalifter.transformerservice.payload.request.CameraEventRequest;
import com.safalifter.transformerservice.payload.request.CameraRequest;
import com.safalifter.transformerservice.payload.response.CameraResponse;
import com.safalifter.transformerservice.repository.CameraRepository;
import com.safalifter.transformerservice.repository.SensorReadingRepository;
import com.safalifter.transformerservice.repository.SensorRepository;
import com.safalifter.transformerservice.repository.TransformerRepository;
import com.safalifter.transformerservice.service.AlertService;
import com.safalifter.transformerservice.service.CameraService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CameraServiceImpl implements CameraService {

    private final CameraRepository cameraRepository;
    private final TransformerRepository transformerRepository;
    private final AlertService alertService;
    private final SensorRepository sensorRepository;
    private final SensorReadingRepository sensorReadingRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public CameraResponse register(CameraRequest request) {
        Camera camera = Camera.builder()
                .name(request.getName())
                .topic(request.getTopic())
                .transformerId(request.getTransformerId())
                .status("ACTIVE")
                .model(request.getModel())
                .wifiSsid(request.getWifiSsid())
                .macAddress(request.getMacAddress())
                .ipAddress(request.getIpAddress())
                .build();
        return toResponse(cameraRepository.save(camera));
    }

    @Override
    public void processEvent(CameraEventRequest event) {
        Optional<Camera> cameraOpt = cameraRepository.findByTopic(event.getTopic());
        if (cameraOpt.isEmpty()) {
            log.warn("Received event from unknown camera topic: {}", event.getTopic());
            return;
        }

        Camera camera = cameraOpt.get();
        String aiClass = event.getAiClass();
        
        // Logic to determine if alert is needed
        if (isCritical(aiClass)) {
            triggerAlert(camera, event);
        }
    }

    private boolean isCritical(String aiClass) {
        return "climbing".equalsIgnoreCase(aiClass) || 
               "fire".equalsIgnoreCase(aiClass) || 
               "intruder".equalsIgnoreCase(aiClass) ||
               "defect".equalsIgnoreCase(aiClass);
    }

    private void triggerAlert(Camera camera, CameraEventRequest event) {
        StringBuilder message = new StringBuilder("Camera detected " + event.getAiClass() + " with confidence " + event.getConfidence());

        AlertRequest.AlertRequestBuilder alertRequestBuilder = AlertRequest.builder()
                .cameraId(camera.getId())
                .isAlert(true)
                .value(event.getAiClass())
                .sensorType("CAMERA")
                .deviceName(camera.getName())
                .deviceId(camera.getTopic());

        if (camera.getTransformerId() != null) {
            Optional<Transformer> transformerOpt = transformerRepository.findById(camera.getTransformerId());
            if (transformerOpt.isPresent()) {
                Transformer tf = transformerOpt.get();
                alertRequestBuilder.transformerId(tf.getId());
                alertRequestBuilder.transformerName(tf.getName());
                alertRequestBuilder.transformerCapacity(tf.getCapacity());
                alertRequestBuilder.depotId(tf.getDepotId());
                alertRequestBuilder.lat(tf.getLat());
                alertRequestBuilder.lng(tf.getLng());

                // Fetch sensors and readings
                List<Sensor> sensors = sensorRepository.findByTransformerId(tf.getId());
                if (!sensors.isEmpty()) {
                    message.append(". Linked Sensors: ");
                    String sensorData = sensors.stream().map(s -> {
                        Optional<SensorReading> reading = sensorReadingRepository.findTopBySensorIdOrderByUpdatedAtDesc(s.getId());
                        return reading.map(r -> s.getType() + "=" + extractValue(r, s.getType())).orElse(s.getType() + "=NoData");
                    }).collect(Collectors.joining(", "));
                    message.append(sensorData);
                }
            }
        }

        alertRequestBuilder.message(message.toString());
        alertService.create(alertRequestBuilder.build());
    }

    private String extractValue(SensorReading reading, String type) {
        try {
            if (reading.getDecoded() == null) return "null";
            JsonNode node = objectMapper.readTree(reading.getDecoded());
            // Try to find the value by type
            if (node.has(type)) return node.get(type).asText();
            if (node.has("data") && node.get("data").has(type)) return node.get("data").get(type).asText();
            // Fallback: return raw JSON or first field
            return node.toString();
        } catch (Exception e) {
            return "Error";
        }
    }

    @Override
    public List<CameraResponse> getAll() {
        return cameraRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Override
    public CameraResponse getById(Long id) {
        return cameraRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Camera not found"));
    }

    @Override
    public void delete(Long id) {
        cameraRepository.deleteById(id);
    }

    private CameraResponse toResponse(Camera camera) {
        return CameraResponse.builder()
                .id(camera.getId())
                .name(camera.getName())
                .topic(camera.getTopic())
                .transformerId(camera.getTransformerId())
                .status(camera.getStatus())
                .model(camera.getModel())
                .wifiSsid(camera.getWifiSsid())
                .macAddress(camera.getMacAddress())
                .ipAddress(camera.getIpAddress())
                .build();
    }
}
