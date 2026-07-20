package com.safalifter.authservice.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import com.safalifter.authservice.payload.request.RegionRequest;
import com.safalifter.authservice.payload.response.RegionResponse;
import com.safalifter.authservice.service.RegionService;

import java.util.List;

@Tag(name = "Regions Endpoints")
@RestController
@RequestMapping("/api/v1/regions")
@RequiredArgsConstructor
@Slf4j
public class RegionController {

    private final RegionService regionService;

    @PostMapping("/create")
    @Operation(summary = "Create a new region")
    @PreAuthorize("hasAuthority('WRITE_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<RegionResponse> create(@Valid @RequestBody RegionRequest request) {
        log.info("Create region: {}", request);
        RegionResponse response = regionService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get region by id")
    @PreAuthorize("hasAuthority('READ_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<RegionResponse> getById(@PathVariable Long id) {
        log.info("Get region id: {}", id);
        return ResponseEntity.ok(regionService.getById(id));
    }

    @GetMapping
    @Operation(summary = "List regions")
    @PreAuthorize("hasAuthority('READ_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<List<RegionResponse>> getAll() {
        log.info("List regions");
        return ResponseEntity.ok(regionService.getAll());
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update region")
    @PreAuthorize("hasAuthority('UPDATE_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<RegionResponse> update(@PathVariable Long id, @Valid @RequestBody RegionRequest request) {
        log.info("Update region id: {} with {}", id, request);
        return ResponseEntity.ok(regionService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete region")
    @PreAuthorize("hasAuthority('DELETE_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        log.info("Delete region id: {}", id);
        regionService.delete(id);
        return ResponseEntity.noContent().build();
    }
}