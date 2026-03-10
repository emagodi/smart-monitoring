package com.safalifter.transformerservice.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safalifter.transformerservice.entities.Camera;
import com.safalifter.transformerservice.entities.CameraImage;
import com.safalifter.transformerservice.entities.Sensor;
import com.safalifter.transformerservice.entities.SensorReading;
import com.safalifter.transformerservice.entities.Transformer;
import com.safalifter.transformerservice.payload.request.AlertRequest;
import com.safalifter.transformerservice.payload.request.CameraEventRequest;
import com.safalifter.transformerservice.payload.request.CameraRequest;
import com.safalifter.transformerservice.payload.response.CameraImageResponse;
import com.safalifter.transformerservice.payload.response.CameraResponse;
import com.safalifter.transformerservice.repository.CameraImageRepository;
import com.safalifter.transformerservice.repository.CameraRepository;
import com.safalifter.transformerservice.repository.SensorReadingRepository;
import com.safalifter.transformerservice.repository.SensorRepository;
import com.safalifter.transformerservice.entities.*;
import com.safalifter.transformerservice.repository.*;
import com.safalifter.transformerservice.service.AlertService;
import com.safalifter.transformerservice.service.CameraService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
@Slf4j
public class CameraServiceImpl implements CameraService {

    private final CameraRepository cameraRepository;
    private final CameraImageRepository cameraImageRepository;
    private final SimulationCameraRepository simulationCameraRepository;
    private final SimulationCameraImageRepository simulationCameraImageRepository;
    private final TransformerRepository transformerRepository;
    private final AlertService alertService;
    private final SensorRepository sensorRepository;
    private final SensorReadingRepository sensorReadingRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${app.image-storage-dir:uploads/images}")
    private String imageStorageDir;

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
    public CameraResponse update(Long id, CameraRequest request) {
        Camera camera = cameraRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Camera not found"));

        camera.setName(request.getName());
        camera.setTopic(request.getTopic());
        camera.setTransformerId(request.getTransformerId());
        camera.setModel(request.getModel());
        camera.setWifiSsid(request.getWifiSsid());
        camera.setMacAddress(request.getMacAddress());
        camera.setIpAddress(request.getIpAddress());
        // Status updates can be handled separately if needed, but defaulting to existing or active

        return toResponse(cameraRepository.save(camera));
    }

    @Override
    public void delete(Long id) {
        if (!cameraRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Camera not found");
        }
        cameraRepository.deleteById(id);
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

        // Save image record if imagePath is present
        if (event.getImagePath() != null && !event.getImagePath().isEmpty()) {
            // Extract filename from the path
            String filename = Paths.get(event.getImagePath()).getFileName().toString();
            String dbPath = "/api/v1/cameras/images/" + filename;
            CameraImage image = CameraImage.builder()
                    .camera(camera)
                    .imagePath(dbPath)
                    .build();
            cameraImageRepository.save(image);
        }
        
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
    public List<CameraResponse> getByTransformerId(Long transformerId) {
        return cameraRepository.findByTransformerId(transformerId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    public CameraResponse getById(Long id) {
        return cameraRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Camera not found"));
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

    @Override
    public CameraImageResponse saveImage(Long cameraId, MultipartFile file) {
        Camera camera = cameraRepository.findById(cameraId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Camera not found"));

        try {
            Path uploadPath = Paths.get(imageStorageDir);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }

            String filename = "camera_" + cameraId + "_" + System.currentTimeMillis() + "_" + file.getOriginalFilename();
            Path filePath = uploadPath.resolve(filename);
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

            String dbPath = "/api/v1/cameras/images/" + filename;
            CameraImage image = CameraImage.builder()
                    .camera(camera)
                    .imagePath(dbPath)
                    .build();

            CameraImage savedImage = cameraImageRepository.save(image);
            return toImageResponse(savedImage);

        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to store file", e);
        }
    }

    @Override
    public List<CameraImageResponse> getLatestImages(Long cameraId) {
        List<CameraImageResponse> responses = new ArrayList<>();
        
        // 1. Get Real Images
        List<CameraImageResponse> realImages = cameraImageRepository.findTop5ByCameraIdOrderByCapturedAtDesc(cameraId).stream()
                .map(this::toImageResponse)
                .collect(Collectors.toList());
        responses.addAll(realImages);

        // 2. Get Simulation Images (if applicable)
        Optional<Camera> cameraOpt = cameraRepository.findById(cameraId);
        if (cameraOpt.isPresent()) {
            Camera camera = cameraOpt.get();
            if (camera.getTransformerId() != null) {
                 List<SimulationCamera> simCameras = simulationCameraRepository.findByTransformerId(camera.getTransformerId());
                 for (SimulationCamera simCamera : simCameras) {
                     // ALWAYS fetch simulation images if on same transformer, regardless of IP
                     // This covers cases where Simulation Camera IP differs from Real Camera Placeholder
                     List<CameraImageResponse> simImages = simulationCameraImageRepository.findTop5BySimulationCameraIdOrderByCapturedAtDesc(simCamera.getId()).stream()
                             .map(this::toSimImageResponse)
                             .collect(Collectors.toList());
                     responses.addAll(simImages);
                 }
             }
        }

        // Sort combined list and limit to 5
        return responses.stream()
                .sorted(Comparator.comparing(CameraImageResponse::getCapturedAt).reversed())
                .limit(5)
                .collect(Collectors.toList());
    }

    @Override
    public List<CameraImageResponse> getImagesByDateRange(Long cameraId, LocalDateTime start, LocalDateTime end) {
        List<CameraImageResponse> responses = new ArrayList<>();

        // 1. Real Images
        List<CameraImageResponse> realImages = cameraImageRepository.findByCameraIdAndCapturedAtBetweenOrderByCapturedAtDesc(cameraId, start, end).stream()
                .map(this::toImageResponse)
                .collect(Collectors.toList());
        responses.addAll(realImages);

        // 2. Simulation Images
        Optional<Camera> cameraOpt = cameraRepository.findById(cameraId);
        if (cameraOpt.isPresent()) {
             Camera camera = cameraOpt.get();
             if (camera.getTransformerId() != null) {
                 List<SimulationCamera> simCameras = simulationCameraRepository.findByTransformerId(camera.getTransformerId());
                 for (SimulationCamera simCamera : simCameras) {
                     // ALWAYS fetch simulation images if on same transformer
                     List<CameraImageResponse> simImages = simulationCameraImageRepository.findBySimulationCameraIdAndCapturedAtBetweenOrderByCapturedAtDesc(simCamera.getId(), start, end).stream()
                             .map(this::toSimImageResponse)
                             .collect(Collectors.toList());
                     responses.addAll(simImages);
                 }
             }
        }
        
        return responses.stream()
                .sorted(Comparator.comparing(CameraImageResponse::getCapturedAt).reversed())
                .collect(Collectors.toList());
    }

    @Override
    public Resource getImage(String filename) {
        try {
            Path file = Paths.get(imageStorageDir).resolve(filename);
            Resource resource = new UrlResource(file.toUri());
            if (resource.exists() || resource.isReadable()) {
                return resource;
            } else {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Could not read file: " + filename);
            }
        } catch (MalformedURLException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Error: " + e.getMessage());
        }
    }

    private CameraImageResponse toImageResponse(CameraImage image) {
        String imagePath = image.getImagePath();
        String filename;
        String imageUrl;

        if (imagePath != null && imagePath.startsWith("simulation/")) {
            // It's a simulation image path (relative)
            filename = imagePath; // Keep the path structure
            imageUrl = "/api/v1/cameras/images/" + filename;
        } else if (imagePath != null && imagePath.startsWith("/api/v1/cameras/images/")) {
             filename = imagePath.substring("/api/v1/cameras/images/".length());
             imageUrl = imagePath;
        } else if (imagePath != null) {
            String normalizedPath = imagePath.replace('\\', '/');
            filename = Paths.get(normalizedPath).getFileName().toString();
            imageUrl = "/api/v1/cameras/images/" + filename;
        } else {
            filename = "unknown.jpg";
            imageUrl = "";
        }
        
        return CameraImageResponse.builder()
                .id(image.getId())
                .imageUrl(imageUrl)
                .capturedAt(image.getCapturedAt())
                .transformerId(image.getCamera().getTransformerId())
                .cameraMacAddress(image.getCamera().getMacAddress())
                .cameraModel(image.getCamera().getModel())
                .cameraWifiSsid(image.getCamera().getWifiSsid())
                .build();
    }

    private CameraImageResponse toSimImageResponse(SimulationCameraImage image) {
        // Simulation images are stored as "simulation/filename.jpg"
        String imageUrl = "/api/v1/cameras/images/" + image.getImagePath();
        
        return CameraImageResponse.builder()
                .id(image.getId()) // This might collide with real image IDs in frontend if not careful, but usually separate tables
                .imageUrl(imageUrl)
                .capturedAt(image.getCapturedAt())
                .transformerId(image.getSimulationCamera().getTransformerId())
                .cameraMacAddress(image.getSimulationCamera().getMacAddress())
                .cameraModel(image.getSimulationCamera().getModel())
                .cameraWifiSsid(image.getSimulationCamera().getWifiSsid())
                .build();
    }
}
