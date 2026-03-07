package com.safalifter.transformerservice.controller;

import com.safalifter.transformerservice.entities.Camera;
import com.safalifter.transformerservice.entities.Controller;
import com.safalifter.transformerservice.entities.ControllerReading;
import com.safalifter.transformerservice.entities.Transformer;
import com.safalifter.transformerservice.repository.CameraRepository;
import com.safalifter.transformerservice.repository.ControllerRepository;
import com.safalifter.transformerservice.repository.TransformerRepository;
import com.safalifter.transformerservice.service.CameraService;
import com.safalifter.transformerservice.service.ControllerReadingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Tag(name = "Simulation Endpoints")
@RestController
@RequestMapping("/api/v1/simulation")
@RequiredArgsConstructor
@Slf4j
public class SimulationController {

    private final TransformerRepository transformerRepository;
    private final ControllerRepository controllerRepository;
    private final CameraRepository cameraRepository;
    private final CameraService cameraService;
    private final ControllerReadingService controllerReadingService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Simulate controller reading and camera image")
    // @PreAuthorize("hasAuthority('WRITE_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<String> simulate(
            @RequestParam("transformerId") Long transformerId,
            @RequestParam("di1") Boolean di1,
            @RequestParam("di2") Boolean di2,
            @RequestParam(value = "file", required = false) MultipartFile file) {

        log.info("Simulation request: transformerId={}, di1={}, di2={}", transformerId, di1, di2);

        // 1. Validate Transformer
        Transformer transformer = transformerRepository.findById(transformerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer not found"));

        // 2. Find Controller
        List<Controller> controllers = controllerRepository.findByTransformerId(transformerId);
        if (controllers.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No controller associated with this transformer");
        }
        Controller controller = controllers.get(0);

        // 3. Find Camera and Save Image (if provided)
        if (file != null && !file.isEmpty()) {
            List<Camera> cameras = cameraRepository.findByTransformerId(transformerId);
            if (cameras.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No camera associated with this transformer");
            }
            Camera camera = cameras.get(0);
            cameraService.saveImage(camera.getId(), file);
            log.info("Simulated image saved for camera {}", camera.getId());
        }

        // 4. Create and Save Controller Reading (Triggers Alert Logic)
        ControllerReading reading = ControllerReading.builder()
                .controllerId(controller.getId())
                .di1(di1)
                .di2(di2)
                .battery(100) // Simulated values
                .rssi(-50)
                .snr(10)
                .rawPayload("SIMULATION")
                .build();

        controllerReadingService.save(reading);
        log.info("Simulated reading saved for controller {}", controller.getId());

        return ResponseEntity.ok("Simulation executed successfully. Reading saved and alert logic triggered.");
    }
}
