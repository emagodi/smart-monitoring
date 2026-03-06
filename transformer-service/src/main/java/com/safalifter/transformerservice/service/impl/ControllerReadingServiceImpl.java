package com.safalifter.transformerservice.service.impl;

import com.safalifter.transformerservice.entities.*;
import com.safalifter.transformerservice.repository.*;
import com.safalifter.transformerservice.service.ControllerReadingService;
import com.safalifter.transformerservice.service.AlertService;
import com.safalifter.transformerservice.payload.request.AlertRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Service
@Transactional
@RequiredArgsConstructor
public class ControllerReadingServiceImpl implements ControllerReadingService {

    private final ControllerReadingRepository repository;
    private final ControllerRepository controllerRepository;
    private final TransformerRepository transformerRepository;
    private final CameraRepository cameraRepository;
    private final CameraImageRepository cameraImageRepository;
    private final AlertService alertService;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${vision.ai.url:http://vision-ai-service:8000}")
    private String visionAiUrl;

    @Value("${app.image-storage-dir:uploads/images}")
    private String imageStorageDir;

    @Override
    public ControllerReading save(ControllerReading reading) {
        ControllerReading saved = repository.save(reading);
        processTriggers(saved);
        return saved;
    }

    private void processTriggers(ControllerReading reading) {
        if (Boolean.TRUE.equals(reading.getDi1()) || Boolean.TRUE.equals(reading.getDi2())) { // Motion or Sensor Triggered
            Optional<Controller> controllerOpt = controllerRepository.findById(reading.getControllerId());
            if (controllerOpt.isPresent()) {
                Controller controller = controllerOpt.get();
                if (controller.getTransformerId() != null) {
                    Optional<Transformer> transformerOpt = transformerRepository.findById(controller.getTransformerId());
                    if (transformerOpt.isPresent()) {
                        Transformer transformer = transformerOpt.get();
                        List<Camera> cameras = cameraRepository.findByTransformerId(transformer.getId());
                        if (!cameras.isEmpty()) {
                            Camera camera = cameras.get(0); // Use first camera
                            List<CameraImage> images = cameraImageRepository.findTop5ByCameraIdOrderByCapturedAtDesc(camera.getId());
                            if (!images.isEmpty()) {
                                analyzeImageAndAlert(images.get(0), transformer, controller);
                            }
                        }
                    }
                }
            }
        }
    }

    private void analyzeImageAndAlert(CameraImage image, Transformer transformer, Controller controller) {
        try {
            String filename = image.getImagePath().substring(image.getImagePath().lastIndexOf("/") + 1);
            Path filePath = Paths.get(imageStorageDir).resolve(filename);

            if (!filePath.toFile().exists()) {
                return;
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", new FileSystemResource(filePath.toFile()));
            body.add("modelType", "security");

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            String url = visionAiUrl + "/analyze/upload";
            ResponseEntity<String> response = restTemplate.postForEntity(url, requestEntity, String.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> result = objectMapper.readValue(response.getBody(), Map.class);
                String detectedClass = (String) result.get("detectedClass");
                String alertLevel = (String) result.get("alertLevel");

                if ("intruder".equalsIgnoreCase(detectedClass) || 
                    "person".equalsIgnoreCase(detectedClass) || 
                    "human".equalsIgnoreCase(detectedClass) || 
                    "CRITICAL".equalsIgnoreCase(alertLevel)) {
                    
                    createAlert(image, transformer, controller, detectedClass);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void createAlert(CameraImage image, Transformer transformer, Controller controller, String detectedClass) {
        AlertRequest alert = AlertRequest.builder()
                .transformerId(transformer.getId())
                .transformerName(transformer.getName())
                .transformerCapacity(transformer.getCapacity())
                .depotId(transformer.getDepotId())
                .lat(transformer.getLat())
                .lng(transformer.getLng())
                .deviceId(controller.getDeviceId())
                .deviceName(controller.getName())
                .sensorType("CONTROLLER_VISION")
                .isAlert(true)
                .value(detectedClass)
                .message("Motion detected on Controller. Vision AI confirmed: " + detectedClass)
                .imageUrl(image.getImagePath())
                .build();
        
        alertService.create(alert);
    }

    @Override
    public List<ControllerReading> getByControllerId(Long controllerId) {
        return repository.findByControllerId(controllerId);
    }

    @Override
    public Page<ControllerReading> getByControllerId(Long controllerId, Pageable pageable) {
        return repository.findByControllerId(controllerId, pageable);
    }

    @Override
    public List<ControllerReading> getByControllerIdAndDateRange(Long controllerId, java.time.LocalDateTime start, java.time.LocalDateTime end) {
        return repository.findByControllerIdAndCreatedAtBetween(controllerId, start, end);
    }

    @Override
    public Page<ControllerReading> getByControllerIdAndDateRange(Long controllerId, java.time.LocalDateTime start, java.time.LocalDateTime end, Pageable pageable) {
        return repository.findByControllerIdAndCreatedAtBetween(controllerId, start, end, pageable);
    }
}
