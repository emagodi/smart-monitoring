package com.safalifter.transformerservice.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safalifter.transformerservice.entities.Camera;
import com.safalifter.transformerservice.entities.CameraImage;
import com.safalifter.transformerservice.entities.Sensor;
import com.safalifter.transformerservice.entities.SensorReading;
import com.safalifter.transformerservice.entities.Transformer;
import com.safalifter.transformerservice.payload.request.AlertRequest;
import com.safalifter.transformerservice.payload.request.SensorReadingRequest;
import com.safalifter.transformerservice.payload.request.SimulationRequest;
import com.safalifter.transformerservice.payload.response.SimulationResponse;
import com.safalifter.transformerservice.repository.CameraImageRepository;
import com.safalifter.transformerservice.repository.CameraRepository;
import com.safalifter.transformerservice.repository.SensorReadingRepository;
import com.safalifter.transformerservice.repository.SensorRepository;
import com.safalifter.transformerservice.repository.TransformerRepository;
import com.safalifter.transformerservice.service.AlertService;
import com.safalifter.transformerservice.service.SensorReadingService;
import com.safalifter.transformerservice.service.SimulationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SimulationServiceImpl implements SimulationService {

    private final SensorReadingService sensorReadingService;
    private final SensorRepository sensorRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Random random = new Random();
    private final CameraRepository cameraRepository;
    private final CameraImageRepository cameraImageRepository;
    private final TransformerRepository transformerRepository;
    private final AlertService alertService;
    private final SensorReadingRepository sensorReadingRepository;

    @Value("${vision.ai.url:http://vision-ai-service:8000}")
    private String visionAiUrl;

    @Value("${app.image-storage-dir:uploads/images}")
    private String imageStorageDir;

    @Override
    public SimulationResponse simulateSensor(SimulationRequest request) {
        Sensor sensor = sensorRepository.findById(request.getSensorId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sensor not found"));

        double value = 0.0;
        String alertLevel = "SAFE";

        if (request.getCodedValue() != null) {
            value = decodeValue(request.getCodedValue(), sensor.getType());
        } else if (request.getRawValue() != null) {
            value = request.getRawValue();
        }

        // Determine Alert Level based on value and type
        alertLevel = determineAlertLevel(value, sensor.getType());

        // Create Sensor Reading Payload
        Map<String, Object> data = new HashMap<>();
        // Map sensor type to payload key
        String key = mapTypeToKey(sensor.getType());
        data.put(key, value);
        
        // Wrap in 'data' object as expected by SensorReadingServiceImpl extraction logic
        Map<String, Object> payload = new HashMap<>();
        payload.put("data", data);

        try {
            String jsonPayload = objectMapper.writeValueAsString(payload);
            sensorReadingService.create(SensorReadingRequest.builder()
                    .sensorId(sensor.getId())
                    .decoded(jsonPayload)
                    .rawPayload("")
                    .build());
        } catch (Exception e) {
            log.error("Failed to create sensor reading", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create reading");
        }

        return SimulationResponse.builder()
                .status("SUCCESS")
                .message("Sensor reading simulated: " + value + " (" + alertLevel + ")")
                .rawValue(value)
                .alertLevel(alertLevel)
                .build();
    }

    @Override
    public SimulationResponse simulateCameraImage(Long transformerId, MultipartFile file, String modelType) {
        try {
            // 1. Find or Create Camera for this Transformer
            List<Camera> cameras = cameraRepository.findByTransformerId(transformerId);
            Camera camera;
            if (cameras.isEmpty()) {
                // Create a virtual camera for simulation if none exists
                log.info("No camera found for transformer {}, creating a simulation camera", transformerId);
                Transformer transformer = transformerRepository.findById(transformerId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer not found"));
                
                camera = Camera.builder()
                        .name("Simulated Camera - " + transformer.getName())
                        .topic("simulation/" + transformer.getId() + "/camera")
                        .transformerId(transformer.getId())
                        .status("ACTIVE")
                        .model("SIM-CAM-01")
                        .build();
                camera = cameraRepository.save(camera);
            } else {
                camera = cameras.get(0);
            }

            // 2. Save Image locally (mimic ingestion)
            String fileName = System.currentTimeMillis() + "_" + file.getOriginalFilename();
            Path uploadPath = Paths.get(imageStorageDir);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }
            Path filePath = uploadPath.resolve(fileName);
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);
            
            // 3. Create CameraImage record
            String dbPath = "/api/v1/cameras/images/" + fileName;
            CameraImage cameraImage = CameraImage.builder()
                    .camera(camera)
                    .imagePath(dbPath)
                    .build();
            cameraImageRepository.save(cameraImage);

            // 4. Analyze Image (reuse existing logic)
            SimulationResponse analysisResult = analyzeImage(file, modelType);
            
            // 5. Trigger Alert if needed (mimic CameraService.processEvent logic)
            String aiClass = analysisResult.getVisionResult().getDetectedClass();
            Double confidence = analysisResult.getVisionResult().getConfidence();
            String alertLevel = analysisResult.getAlertLevel();
            
            if ("CRITICAL".equalsIgnoreCase(alertLevel) || "WARNING".equalsIgnoreCase(alertLevel)) {
                triggerSimulationAlert(camera, aiClass, confidence, alertLevel, modelType);
            }

            return analysisResult;

        } catch (Exception e) {
            log.error("Failed to process simulation camera image", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to process image: " + e.getMessage());
        }
    }

    private void triggerSimulationAlert(Camera camera, String aiClass, Double confidence, String alertLevel, String modelType) {
        StringBuilder message = new StringBuilder("Vision AI (" + modelType + ") detected " + aiClass + " with confidence " + String.format("%.2f", confidence));

        AlertRequest.AlertRequestBuilder alertRequestBuilder = AlertRequest.builder()
                .cameraId(camera.getId())
                .isAlert(true)
                .value(aiClass)
                .sensorType("CAMERA") // Or VISION_AI
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

                // Fetch sensors and readings context
                List<Sensor> sensors = sensorRepository.findByTransformerId(tf.getId());
                if (!sensors.isEmpty()) {
                    message.append(". Context: ");
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
            if (node.has(type)) return node.get(type).asText();
            if (node.has("data") && node.get("data").has(type)) return node.get("data").get(type).asText();
            return node.toString();
        } catch (Exception e) {
            return "Error";
        }
    }

    @Override
    public SimulationResponse analyzeImage(MultipartFile file, String modelType) {
        try {
            log.info("Calling Vision AI Service at {} with model {}", visionAiUrl, modelType);
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename();
                }
            });

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
            
            String url = visionAiUrl + "/analyze/upload?modelType=" + modelType;
            Map<String, Object> response = restTemplate.postForObject(url, requestEntity, Map.class);
            
            if (response == null) {
                throw new RuntimeException("Empty response from Vision AI Service");
            }

            String detectedClass = (String) response.get("detectedClass");
            Double confidence = ((Number) response.get("confidence")).doubleValue();
            String alertLevel = (String) response.get("alertLevel");
            // Handle bounding boxes safely
            java.util.List<String> boxes = new ArrayList<>();
            Object boxObj = response.get("boundingBoxes");
            if (boxObj instanceof java.util.List) {
                java.util.List<?> list = (java.util.List<?>) boxObj;
                for (Object item : list) {
                    boxes.add(objectMapper.writeValueAsString(item));
                }
            }

            return SimulationResponse.builder()
                .status("SUCCESS")
                .message("Image analyzed using " + modelType + " model (via Vision AI Service)")
                .alertLevel(alertLevel)
                .visionResult(SimulationResponse.VisionAnalysisResult.builder()
                        .modelType(modelType)
                        .detectedClass(detectedClass)
                        .confidence(confidence)
                        .boundingBoxes(boxes)
                        .build())
                .build();

        } catch (Exception e) {
            log.error("Failed to call Vision AI Service", e);
            // Fallback to mock logic if service is down
            return fallbackAnalyzeImage(file, modelType);
        }
    }

    private SimulationResponse fallbackAnalyzeImage(MultipartFile file, String modelType) {
        log.warn("Using fallback mock logic for image analysis");
        String detectedClass = "normal";
        double confidence = 0.85 + (random.nextDouble() * 0.14); // 0.85 - 0.99
        String alertLevel = "SAFE";

        // Logic based on filename keywords for demo purposes
        String filename = file.getOriginalFilename().toLowerCase();
        
        if (modelType.equalsIgnoreCase("security")) {
            if (filename.contains("person") || filename.contains("intruder")) {
                detectedClass = "intruder";
                alertLevel = "CRITICAL";
            } else if (filename.contains("car") || filename.contains("vehicle")) {
                detectedClass = "vehicle";
                alertLevel = "WARNING";
            }
        } else if (modelType.equalsIgnoreCase("fire")) {
            if (filename.contains("fire") || filename.contains("flame")) {
                detectedClass = "fire";
                alertLevel = "CRITICAL";
            } else if (filename.contains("smoke")) {
                detectedClass = "smoke";
                alertLevel = "CRITICAL";
            }
        } else if (modelType.equalsIgnoreCase("defect")) {
            if (filename.contains("rust")) {
                detectedClass = "rust";
                alertLevel = "WARNING";
            } else if (filename.contains("crack")) {
                detectedClass = "crack";
                alertLevel = "CRITICAL";
            } else if (filename.contains("leak") || filename.contains("oil")) {
                detectedClass = "oil_leak";
                alertLevel = "CRITICAL";
            }
        } else if (modelType.equalsIgnoreCase("door")) {
            if (filename.contains("open")) {
                detectedClass = "door_open";
                alertLevel = "CRITICAL";
            } else if (filename.contains("closed")) {
                detectedClass = "door_closed";
                alertLevel = "SAFE";
            }
        } else {
            // Default General Model
            if (filename.contains("climb")) {
                detectedClass = "climbing";
                alertLevel = "CRITICAL";
            } else if (filename.contains("fire")) {
                detectedClass = "fire";
                alertLevel = "CRITICAL";
            }
        }

        return SimulationResponse.builder()
                .status("SUCCESS")
                .message("Image analyzed using " + modelType + " model (FALLBACK)")
                .alertLevel(alertLevel)
                .visionResult(SimulationResponse.VisionAnalysisResult.builder()
                        .modelType(modelType)
                        .detectedClass(detectedClass)
                        .confidence(confidence)
                        .boundingBoxes(generateMockBoundingBox(detectedClass))
                        .build())
                .build();
    }

    private double decodeValue(String coded, String type) {
        // Mock decoding logic
        if (type.equalsIgnoreCase("temperature")) {
            switch (coded.toUpperCase()) {
                case "LOW": return 20.0;
                case "NORMAL": return 45.0;
                case "HIGH": return 75.0;
                case "CRITICAL": return 95.0;
                default: return 0.0;
            }
        } else if (type.equalsIgnoreCase("oil_level") || type.equalsIgnoreCase("level")) {
            switch (coded.toUpperCase()) {
                case "LOW": return 15.0; // Warning
                case "NORMAL": return 60.0;
                case "HIGH": return 90.0; // Warning
                default: return 50.0;
            }
        } else if (type.equalsIgnoreCase("vibration")) {
             switch (coded.toUpperCase()) {
                case "SMOOTH": return 0.1;
                case "ROUGH": return 0.6;
                case "DANGEROUS": return 2.5;
                default: return 0.0;
            }
        } else if (type.equalsIgnoreCase("contact")) {
             switch (coded.toUpperCase()) {
                case "CLOSED": return 0.0;
                case "OPEN": return 1.0;
                case "CRITICAL": return 1.0; // Assume critical means open for contact
                default: return 0.0;
            }
        }
        return 0.0;
    }

    private String determineAlertLevel(double value, String type) {
        if (type.equalsIgnoreCase("temperature")) {
            if (value > 90) return "CRITICAL";
            if (value > 70) return "WARNING";
        } else if (type.equalsIgnoreCase("vibration")) {
            if (value > 1.0) return "CRITICAL";
            if (value > 0.5) return "WARNING";
        } else if (type.equalsIgnoreCase("contact")) {
            if (value == 1.0) return "CRITICAL"; // Door Open
        }
        return "SAFE";
    }

    private String mapTypeToKey(String type) {
        type = type.toLowerCase();
        if (type.contains("temp")) return "temperature";
        if (type.contains("vib")) return "vibration";
        if (type.contains("hum")) return "humidity";
        if (type.contains("oil") || type.contains("level")) return "oil_level";
        if (type.contains("contact")) return "contact";
        return type; // default
    }

    private java.util.List<String> generateMockBoundingBox(String detectedClass) {
        if (detectedClass.equals("normal")) return Collections.emptyList();
        java.util.List<String> boxes = new ArrayList<>();
        // Format: [x, y, w, h, label]
        boxes.add("[100, 100, 200, 200, \"" + detectedClass + "\"]");
        return boxes;
    }
}
