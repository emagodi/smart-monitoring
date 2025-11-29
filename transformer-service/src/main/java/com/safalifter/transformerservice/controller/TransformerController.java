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
import com.safalifter.transformerservice.payload.request.TransformerRequest;
import com.safalifter.transformerservice.payload.response.TransformerResponse;
import com.safalifter.transformerservice.service.TransformerService;

import java.util.List;

@Tag(name = "Transformer Endpoints")
@RestController
@RequestMapping("/api/v1/transformers")
@RequiredArgsConstructor
@Slf4j
public class TransformerController {

    private final TransformerService transformerService;

    @PostMapping("/create")
    @Operation(summary = "Create a new transformer")
    @PreAuthorize("hasAuthority('WRITE_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<TransformerResponse> create(@Valid @RequestBody TransformerRequest request) {
        TransformerResponse response = transformerService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get transformer by id")
    @PreAuthorize("hasAuthority('READ_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<TransformerResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(transformerService.getById(id));
    }

    @GetMapping
    @Operation(summary = "List transformers")
    @PreAuthorize("hasAuthority('READ_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<List<TransformerResponse>> getAll() {
        return ResponseEntity.ok(transformerService.getAll());
    }

    @GetMapping("/depot/{depotId}")
    @Operation(summary = "List transformers by depot")
    @PreAuthorize("hasAuthority('READ_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<List<TransformerResponse>> listByDepot(@PathVariable Long depotId) {
        return ResponseEntity.ok(transformerService.listByDepotId(depotId));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update transformer")
    @PreAuthorize("hasAuthority('UPDATE_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<TransformerResponse> update(@PathVariable Long id, @Valid @RequestBody TransformerRequest request) {
        return ResponseEntity.ok(transformerService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete transformer")
    @PreAuthorize("hasAuthority('DELETE_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        transformerService.delete(id);
        return ResponseEntity.noContent().build();
    }
}