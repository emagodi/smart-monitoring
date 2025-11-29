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
import com.safalifter.authservice.payload.request.DepotRequest;
import com.safalifter.authservice.payload.response.DepotResponse;
import com.safalifter.authservice.service.DepotService;

import java.util.List;

@Tag(name = "Depot Endpoints")
@RestController
@RequestMapping("/api/v1/depots")
@RequiredArgsConstructor
@Slf4j
public class DepotController {

    private final DepotService depotService;

    @PostMapping("/create")
    @Operation(summary = "Create a new depot")
    @PreAuthorize("hasAuthority('WRITE_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<DepotResponse> create(@Valid @RequestBody DepotRequest request) {
        log.info("Create depot: {}", request);
        DepotResponse response = depotService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get depot by id")
    @PreAuthorize("hasAuthority('READ_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<DepotResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(depotService.getById(id));
    }

    @GetMapping
    @Operation(summary = "List depots")
    @PreAuthorize("hasAuthority('READ_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<List<DepotResponse>> getAll() {
        return ResponseEntity.ok(depotService.getAll());
    }

    @GetMapping("/district/{districtId}")
    @Operation(summary = "List depots by district")
    @PreAuthorize("hasAuthority('READ_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<List<DepotResponse>> listByDistrict(@PathVariable Long districtId) {
        return ResponseEntity.ok(depotService.listByDistrictId(districtId));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update depot")
    @PreAuthorize("hasAuthority('UPDATE_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<DepotResponse> update(@PathVariable Long id, @Valid @RequestBody DepotRequest request) {
        return ResponseEntity.ok(depotService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete depot")
    @PreAuthorize("hasAuthority('DELETE_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        depotService.delete(id);
        return ResponseEntity.noContent().build();
    }
}