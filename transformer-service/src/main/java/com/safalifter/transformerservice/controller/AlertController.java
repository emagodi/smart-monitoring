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
import com.safalifter.transformerservice.payload.request.AlertRequest;
import com.safalifter.transformerservice.payload.response.AlertResponse;
import com.safalifter.transformerservice.service.AlertService;

import java.util.List;

@Tag(name = "Alert Endpoints")
@RestController
@RequestMapping("/api/v1/alerts")
@RequiredArgsConstructor
@Slf4j
public class AlertController {

    private final AlertService alertService;

    @PostMapping("/create")
    @Operation(summary = "Create an alert")
    @PreAuthorize("hasAuthority('WRITE_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<AlertResponse> create(@Valid @RequestBody AlertRequest request) {
        AlertResponse response = alertService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get alert by id")
    @PreAuthorize("hasAuthority('READ_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<AlertResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(alertService.getById(id));
    }

    @GetMapping
    @Operation(summary = "List alerts")
    @PreAuthorize("hasAuthority('READ_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<List<AlertResponse>> getAll() {
        return ResponseEntity.ok(alertService.getAll());
    }

    @GetMapping("/sensor/{sensorId}")
    @Operation(summary = "List alerts by sensor")
    @PreAuthorize("hasAuthority('READ_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<List<AlertResponse>> listBySensor(@PathVariable Long sensorId) {
        return ResponseEntity.ok(alertService.listBySensorId(sensorId));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update alert")
    @PreAuthorize("hasAuthority('UPDATE_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<AlertResponse> update(@PathVariable Long id, @Valid @RequestBody AlertRequest request) {
        return ResponseEntity.ok(alertService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete alert")
    @PreAuthorize("hasAuthority('DELETE_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        alertService.delete(id);
        return ResponseEntity.noContent().build();
    }
}