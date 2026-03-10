package com.safalifter.transformerservice.controller;

import com.safalifter.transformerservice.entities.SimulationCamera;
import com.safalifter.transformerservice.entities.SimulationController;
import com.safalifter.transformerservice.payload.request.SimulationRunRequest;
import com.safalifter.transformerservice.service.SimulationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Tag(name = "Simulation Endpoints")
@RestController
@RequestMapping("/api/v1/simulation")
@RequiredArgsConstructor
public class SimulationControllerController {

    private final SimulationService simulationService;

    @PostMapping("/controllers")
    @Operation(summary = "Create a simulation controller")
    public ResponseEntity<SimulationController> createController(@RequestBody SimulationController controller) {
        return ResponseEntity.ok(simulationService.createController(controller));
    }

    @GetMapping("/insights")
    public ResponseEntity<java.util.Map<String, Object>> getAiInsights() {
        return ResponseEntity.ok(simulationService.getAiInsights());
    }

    @GetMapping("/alerts/latest")
    public ResponseEntity<List<com.safalifter.transformerservice.entities.SimulationAlert>> getLatestAlerts() {
        return ResponseEntity.ok(simulationService.getLatestAlerts(10));
    }

    @PostMapping("/cameras")
    @Operation(summary = "Create a simulation camera")
    public ResponseEntity<SimulationCamera> createCamera(@RequestBody SimulationCamera camera) {
        return ResponseEntity.ok(simulationService.createCamera(camera));
    }

    @GetMapping("/controllers")
    public ResponseEntity<List<SimulationController>> getControllers() {
        return ResponseEntity.ok(simulationService.getAllControllers());
    }

    @GetMapping("/cameras")
    public ResponseEntity<List<SimulationCamera>> getCameras() {
        return ResponseEntity.ok(simulationService.getAllCameras());
    }

    @PostMapping(value = "/run", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Run simulation")
    public ResponseEntity<Void> runSimulation(
            @RequestParam("transformerId") Long transformerId,
            @RequestParam(value = "cameraId", required = false) Long cameraId,
            @RequestParam(value = "di1", required = false) Boolean di1,
            @RequestParam(value = "di2", required = false) Boolean di2,
            @RequestPart(value = "image", required = false) MultipartFile image) {
        
        SimulationRunRequest request = new SimulationRunRequest();
        request.setTransformerId(transformerId);
        request.setCameraId(cameraId);
        request.setDi1(di1);
        request.setDi2(di2);
        request.setImage(image);

        simulationService.runSimulation(request);
        return ResponseEntity.ok().build();
    }

    @GetMapping(value = "/uploads/**", produces = MediaType.IMAGE_JPEG_VALUE)
    public ResponseEntity<byte[]> getImage(jakarta.servlet.http.HttpServletRequest request) {
        String path = request.getRequestURI();
        String filename = path.substring(path.indexOf("/uploads/") + 9);
        return ResponseEntity.ok(simulationService.getImage(filename));
    }
}
