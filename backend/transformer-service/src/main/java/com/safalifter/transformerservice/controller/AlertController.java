package com.safalifter.transformerservice.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import com.safalifter.transformerservice.payload.request.AlertCaseUpdateRequest;
import com.safalifter.transformerservice.payload.request.AlertRequest;
import com.safalifter.transformerservice.payload.response.AlertCaseActivityResponse;
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
    public ResponseEntity<Page<AlertResponse>> getAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        return ResponseEntity.ok(alertService.getAll(page, size));
    }

    @GetMapping("/sensor/{sensorId}")
    @Operation(summary = "List alerts by sensor")
    @PreAuthorize("hasAuthority('READ_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<List<AlertResponse>> listBySensor(@PathVariable Long sensorId) {
        return ResponseEntity.ok(alertService.listBySensorId(sensorId));
    }

    @GetMapping("/{id}/timeline")
    @Operation(summary = "Get alert case timeline")
    @PreAuthorize("hasAuthority('READ_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<List<AlertCaseActivityResponse>> getTimeline(@PathVariable Long id) {
        return ResponseEntity.ok(alertService.getTimeline(id));
    }

    @PatchMapping("/{id}/case")
    @Operation(summary = "Update alert case workflow")
    @PreAuthorize("hasAuthority('UPDATE_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<AlertResponse> updateCase(@PathVariable Long id, @RequestBody AlertCaseUpdateRequest request) {
        return ResponseEntity.ok(alertService.updateCase(id, request));
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
