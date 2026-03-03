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
import com.safalifter.transformerservice.payload.request.ControllerRequest;
import com.safalifter.transformerservice.payload.response.ControllerResponse;
import com.safalifter.transformerservice.service.ControllerService;

import java.util.List;

@Tag(name = "Controller Endpoints")
@RestController
@RequestMapping("/api/v1/controllers")
@RequiredArgsConstructor
@Slf4j
public class ControllerController {

    private final ControllerService controllerService;

    @PostMapping("/create")
    @Operation(summary = "Create a new controller")
    @PreAuthorize("hasAuthority('WRITE_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<ControllerResponse> create(@Valid @RequestBody ControllerRequest request) {
        ControllerResponse response = controllerService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get controller by id")
    @PreAuthorize("hasAuthority('READ_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<ControllerResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(controllerService.getById(id));
    }

    @GetMapping
    @Operation(summary = "List controllers")
    @PreAuthorize("hasAuthority('READ_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<List<ControllerResponse>> getAll() {
        return ResponseEntity.ok(controllerService.getAll());
    }

    @GetMapping("/transformer/{transformerId}")
    @Operation(summary = "List controllers by transformer")
    @PreAuthorize("hasAuthority('READ_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<List<ControllerResponse>> listByTransformer(@PathVariable Long transformerId) {
        return ResponseEntity.ok(controllerService.listByTransformerId(transformerId));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update controller")
    @PreAuthorize("hasAuthority('UPDATE_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<ControllerResponse> update(@PathVariable Long id, @Valid @RequestBody ControllerRequest request) {
        return ResponseEntity.ok(controllerService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete controller")
    @PreAuthorize("hasAuthority('DELETE_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        controllerService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
