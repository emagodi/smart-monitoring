package com.safalifter.transformerservice.controller;

import com.safalifter.transformerservice.payload.request.SimulationRequest;
import com.safalifter.transformerservice.payload.response.SimulationResponse;
import com.safalifter.transformerservice.service.SimulationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/simulation")
@RequiredArgsConstructor
@Tag(name = "Simulation", description = "Enterprise Simulation API for Sensor and Vision AI")
public class SimulationController {

    private final SimulationService simulationService;

    @PostMapping("/sensor")
    @Operation(summary = "Simulate Sensor Reading (Coded or Raw)")
    public ResponseEntity<SimulationResponse> simulateSensor(@RequestBody SimulationRequest request) {
        return ResponseEntity.ok(simulationService.simulateSensor(request));
    }

    @PostMapping(value = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Simulate Vision AI Analysis with Specific Model")
    public ResponseEntity<SimulationResponse> analyzeImage(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "modelType", defaultValue = "general") String modelType) {
        return ResponseEntity.ok(simulationService.analyzeImage(file, modelType));
    }

    @PostMapping(value = "/camera-upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload Image as Camera Event for Simulation")
    public ResponseEntity<SimulationResponse> uploadCameraImage(
            @RequestParam("file") MultipartFile file,
            @RequestParam("transformerId") Long transformerId,
            @RequestParam(value = "modelType", defaultValue = "general") String modelType) {
        return ResponseEntity.ok(simulationService.simulateCameraImage(transformerId, file, modelType));
    }
}
