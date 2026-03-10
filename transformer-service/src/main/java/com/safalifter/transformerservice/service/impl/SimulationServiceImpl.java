package com.safalifter.transformerservice.service.impl;

import com.safalifter.transformerservice.entities.*;
import com.safalifter.transformerservice.payload.request.SimulationRunRequest;
import com.safalifter.transformerservice.repository.*;
import com.safalifter.transformerservice.service.SimulationService;
import com.safalifter.transformerservice.service.ControllerReadingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;

@Service
@RequiredArgsConstructor
@Slf4j
public class SimulationServiceImpl implements SimulationService {

    private final SimulationControllerRepository simulationControllerRepository;
    private final SimulationCameraRepository simulationCameraRepository;
    private final SimulationControllerReadingRepository simulationControllerReadingRepository;
    private final SimulationCameraImageRepository simulationCameraImageRepository;
    private final SimulationAlertRepository simulationAlertRepository;
    
    private final ControllerRepository controllerRepository;
    private final CameraRepository cameraRepository;
    private final ControllerReadingService controllerReadingService;
    private final CameraImageRepository cameraImageRepository;

    @Value("${app.image-storage-dir:uploads/images}")
    private String imageStorageDir;

    @Override
    public SimulationController createController(SimulationController controller) {
        // Also ensure real controller exists
        Optional<Controller> realControllerOpt = controllerRepository.findByDevEui(controller.getDevEui());
        if (realControllerOpt.isEmpty()) {
            Controller realController = Controller.builder()
                    .name(controller.getName())
                    .devEui(controller.getDevEui())
                    .deviceId(controller.getDeviceId() != null ? controller.getDeviceId() : controller.getDevEui())
                    .transformerId(controller.getTransformerId())
                    .type(controller.getType() != null ? controller.getType() : "SIMULATION")
                    .build();
            controllerRepository.save(realController);
        }
        return simulationControllerRepository.save(controller);
    }

    @Override
    public SimulationCamera createCamera(SimulationCamera camera) {
        // Also ensure real camera exists
        Optional<Camera> realCameraOpt = cameraRepository.findByIpAddress(camera.getIpAddress());
        if (realCameraOpt.isEmpty()) {
            Camera realCamera = Camera.builder()
                    .name(camera.getName())
                    .ipAddress(camera.getIpAddress())
                    .transformerId(camera.getTransformerId())
                    .model(camera.getModel() != null && !camera.getModel().isEmpty() ? camera.getModel() : "Simulation Model")
                    .status("ACTIVE")
                    .topic(camera.getTopic() != null && !camera.getTopic().isEmpty() ? camera.getTopic() : "sim/camera/" + System.currentTimeMillis())
                    .wifiSsid(camera.getWifiSsid())
                    .macAddress(camera.getMacAddress())
                    .build();
            cameraRepository.save(realCamera);
        }
        return simulationCameraRepository.save(camera);
    }

    @Override
    public List<SimulationController> getAllControllers() {
        return simulationControllerRepository.findAll();
    }

    @Override
    public List<SimulationCamera> getAllCameras() {
        return simulationCameraRepository.findAll();
    }

    @Override
    @Transactional
    public void runSimulation(SimulationRunRequest request) {
        // 1. Get Simulation Controller for Transformer
        Optional<SimulationController> simControllerOpt = simulationControllerRepository.findByTransformerId(request.getTransformerId());
        if (simControllerOpt.isEmpty()) {
            throw new RuntimeException("No Simulation Controller found for this Transformer. Please register one first.");
        }
        SimulationController simController = simControllerOpt.get();

        // 2. Determine Payload
        String payload = getPayload(request.getDi1(), request.getDi2());

        // 3. Save Simulation Reading
        SimulationControllerReading simReading = SimulationControllerReading.builder()
                .simulationControllerId(simController.getId())
                .di1(request.getDi1())
                .di2(request.getDi2())
                .rawPayload(payload)
                .build();
        simulationControllerReadingRepository.save(simReading);

        // 4. Push to REAL System
        // Find Real Controller
        Optional<Controller> realControllerOpt = controllerRepository.findByDevEui(simController.getDevEui());
        Controller realController;
        if (realControllerOpt.isPresent()) {
            realController = realControllerOpt.get();
        } else {
            // Create on fly if missing
            realController = Controller.builder()
                    .name(simController.getName())
                    .devEui(simController.getDevEui())
                    .deviceId(simController.getDeviceId() != null ? simController.getDeviceId() : simController.getDevEui())
                    .transformerId(simController.getTransformerId())
                    .type(simController.getType() != null ? simController.getType() : "SIMULATION")
                    .build();
            realController = controllerRepository.save(realController);
        }

        // 5. Handle Image (if provided) - SAVE IMAGE FIRST so logic finds it!
        if (request.getImage() != null && !request.getImage().isEmpty()) {
            SimulationCamera simCamera = null;
            
            // Try to find by specific ID first
            if (request.getCameraId() != null) {
                Optional<SimulationCamera> cam = simulationCameraRepository.findById(request.getCameraId());
                if (cam.isPresent()) {
                    simCamera = cam.get();
                }
            }
            
            // Fallback: Find by Transformer ID
            if (simCamera == null) {
                List<SimulationCamera> simCameras = simulationCameraRepository.findByTransformerId(request.getTransformerId());
                if (!simCameras.isEmpty()) {
                    simCamera = simCameras.get(0);
                }
            }

            if (simCamera != null) {
                // Save file to disk
                String filename = "sim_" + System.currentTimeMillis() + "_" + request.getImage().getOriginalFilename();
                String storedPath = "simulation/" + filename; // Relative path for DB
                
                try {
                    // Create simulation subdirectory
                    Path uploadPath = Paths.get(imageStorageDir).resolve("simulation");
                    if (!Files.exists(uploadPath)) {
                        Files.createDirectories(uploadPath);
                    }
                    Path filePath = uploadPath.resolve(filename);
                    Files.copy(request.getImage().getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);
                    
                    // 1. Save to Simulation Camera Image Table
                    // Store JUST the filename for easier frontend access if we are serving via /uploads/{filename}
                    // But wait, the backend getImage expects the path.
                    // Let's keep storedPath as "simulation/filename" but ensure getImage handles it.
                    
                    SimulationCameraImage simImage = SimulationCameraImage.builder()
                            .simulationCamera(simCamera)
                            .imagePath(storedPath)
                            .build();
                    simulationCameraImageRepository.save(simImage);

                    // REMOVED: Saving to Real Camera Image Table per user request
                } catch (IOException e) {
                    log.error("Failed to save simulation image", e);
                    throw new RuntimeException("Failed to save image", e);
                }
            }
        }

        // Save Real Reading (Triggers Logic)
        // Auto-trigger Motion (DI1) if an image is provided, ensuring the alert logic runs
        Boolean di1 = request.getDi1();
        if (request.getImage() != null && !request.getImage().isEmpty()) {
            di1 = true;
        }

        ControllerReading reading = ControllerReading.builder()
                .controllerId(realController.getId())
                .rawPayload(payload)
                .di1(di1)
                .di2(request.getDi2())
                .battery(254)
                .rssi(-50)
                .snr(8)
                .build();
        controllerReadingService.save(reading);
    }

    private String getPayload(Boolean di1, Boolean di2) {
        boolean d1 = di1 != null && di1;
        boolean d2 = di2 != null && di2;

        if (d1 && d2) {
            return "000000000000000024ff41"; // Both True
        } else if (d1) {
            return "00f3000000a700a7b4ff41"; // DI1 True
        } else if (d2) {
            return "0000000000000000acff41"; // DI2 True
        } else {
            return "000000000000000024ff41"; // Both False (Per user instruction, same as Both True)
        }
    }

    @Override
    public List<SimulationAlert> getLatestAlerts(int limit) {
        return simulationAlertRepository.findAll(
                org.springframework.data.domain.PageRequest.of(0, limit, org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"))
        ).getContent();
    }

    @Override
    public Map<String, Object> getAiInsights() {
        List<SimulationAlert> alerts = simulationAlertRepository.findAll();
        
        long totalAlerts = alerts.size();
        long intruderCount = alerts.stream().filter(a -> "intruder".equalsIgnoreCase(a.getDetectedClass())).count();
        long climbingCount = alerts.stream().filter(a -> "person climbing".equalsIgnoreCase(a.getDetectedClass())).count();
        long doorOpenCount = alerts.stream().filter(a -> "door_open".equalsIgnoreCase(a.getDetectedClass())).count();
        long fireCount = alerts.stream().filter(a -> "fire".equalsIgnoreCase(a.getDetectedClass())).count();
        
        // Simple Mock Prediction / Anomaly Score
        double anomalyScore = 0.0;
        if (totalAlerts > 0) {
            anomalyScore = (double) (climbingCount * 10 + intruderCount * 8 + doorOpenCount * 5) / totalAlerts;
            if (anomalyScore > 10.0) anomalyScore = 9.8; // Cap at 9.8
        }
        
        Map<String, Object> insights = new java.util.HashMap<>();
        insights.put("totalAlerts", totalAlerts);
        insights.put("intruderCount", intruderCount);
        insights.put("climbingCount", climbingCount);
        insights.put("doorOpenCount", doorOpenCount);
        insights.put("fireCount", fireCount);
        insights.put("anomalyScore", String.format("%.1f", anomalyScore * 10)); // 0-100 scale
        insights.put("systemHealth", anomalyScore > 5 ? "CRITICAL RISK" : (anomalyScore > 2 ? "MODERATE RISK" : "STABLE"));
        insights.put("prediction", anomalyScore > 5 ? "High probability of theft attempt in next 24h based on pattern." : "Normal operational pattern detected.");
        
        return insights;
    }

    @Override
    public byte[] getImage(String filename) {
        try {
            // filename here might come as "simulation/foo.jpg" or just "foo.jpg"
            // The storage logic saves it as "simulation/foo.jpg"
            // If the frontend requests /uploads/simulation/foo.jpg, filename will be "simulation/foo.jpg" (due to regex .+)
            
            Path path = Paths.get(imageStorageDir).resolve(filename);
            
            // Debug logs
            System.out.println("Requested Image: " + filename);
            System.out.println("Resolved Path: " + path.toAbsolutePath());
            
            if (!Files.exists(path)) {
                // Try fallback to just imageStorageDir if path resolution failed
                Path fallback = Paths.get(imageStorageDir).resolve(filename.replace("simulation/", ""));
                if (Files.exists(fallback)) {
                    return Files.readAllBytes(fallback);
                }
                
                // Try hardcoded "simulation" subfolder
                Path subfolder = Paths.get(imageStorageDir).resolve("simulation").resolve(filename.replace("simulation/", ""));
                if (Files.exists(subfolder)) {
                    return Files.readAllBytes(subfolder);
                }

                throw new RuntimeException("Image not found: " + filename);
            }
            return Files.readAllBytes(path);
        } catch (IOException e) {
            throw new RuntimeException("Error reading image", e);
        }
    }
}
