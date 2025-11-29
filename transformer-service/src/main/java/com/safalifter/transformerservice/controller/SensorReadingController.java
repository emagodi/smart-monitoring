package com.safalifter.transformerservice.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import com.safalifter.transformerservice.payload.request.SensorReadingRequest;
import com.safalifter.transformerservice.payload.response.SensorReadingResponse;
import com.safalifter.transformerservice.service.SensorReadingService;

import java.util.List;

@Tag(name = "Sensor Reading Endpoints")
@RestController
@RequestMapping("/api/v1/sensor-readings")
@RequiredArgsConstructor
@Slf4j
public class SensorReadingController {

    private final SensorReadingService sensorReadingService;

    @PostMapping("/create")
    @Operation(summary = "Create a sensor reading")
    @PreAuthorize("hasAuthority('WRITE_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<SensorReadingResponse> create(@Valid @RequestBody SensorReadingRequest request) {
        SensorReadingResponse response = sensorReadingService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get sensor reading by id")
    @PreAuthorize("hasAuthority('READ_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<SensorReadingResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(sensorReadingService.getById(id));
    }

    @GetMapping
    @Operation(summary = "List sensor readings")
    @PreAuthorize("hasAuthority('READ_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<List<SensorReadingResponse>> getAll() {
        return ResponseEntity.ok(sensorReadingService.getAll());
    }

    @GetMapping("/sensor/{sensorId}")
    @Operation(summary = "List readings by sensor")
    @PreAuthorize("hasAuthority('READ_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<List<SensorReadingResponse>> listBySensor(@PathVariable Long sensorId) {
        return ResponseEntity.ok(sensorReadingService.listBySensorId(sensorId));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update sensor reading")
    @PreAuthorize("hasAuthority('UPDATE_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<SensorReadingResponse> update(@PathVariable Long id, @Valid @RequestBody SensorReadingRequest request) {
        return ResponseEntity.ok(sensorReadingService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete sensor reading")
    @PreAuthorize("hasAuthority('DELETE_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        sensorReadingService.delete(id);
        return ResponseEntity.noContent().build();
    }
}