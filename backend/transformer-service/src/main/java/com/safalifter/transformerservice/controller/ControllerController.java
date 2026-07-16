package com.safalifter.transformerservice.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;
import com.safalifter.transformerservice.payload.request.ControllerRequest;
import com.safalifter.transformerservice.payload.response.ControllerResponse;
import com.safalifter.transformerservice.entities.ControllerReading;
import com.safalifter.transformerservice.service.ControllerReadingService;
import com.safalifter.transformerservice.service.ControllerService;

import java.time.LocalDateTime;
import java.util.List;

@Tag(name = "Controller Endpoints")
@RestController
@RequestMapping("/api/v1/controllers")
@RequiredArgsConstructor
@Slf4j
public class ControllerController {

    private final ControllerService controllerService;
    private final ControllerReadingService controllerReadingService;

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

    @PostMapping("/{id}/readings")
    @Operation(summary = "Create a controller reading manually")
    @PreAuthorize("hasAuthority('WRITE_PRIVILEGE')")
    public ResponseEntity<ControllerReading> createReading(@PathVariable Long id, @RequestBody ControllerReading reading) {
        reading.setControllerId(id);
        return ResponseEntity.ok(controllerReadingService.save(reading));
    }

    @GetMapping("/{id}/readings")
    @Operation(summary = "List controller readings")
    @PreAuthorize("hasAuthority('READ_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<Page<ControllerReading>> getReadings(
            @PathVariable Long id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(controllerReadingService.getByControllerId(id, PageRequest.of(page, size, Sort.by("createdAt").descending())));
    }

    @GetMapping("/{id}/readings/filter")
    @Operation(summary = "Filter controller readings")
    @PreAuthorize("hasAuthority('READ_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<Page<ControllerReading>> getReadingsFiltered(
            @PathVariable Long id,
            @RequestParam String start,
            @RequestParam String end,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        try {
            // Parse ISO dates (ZonedDateTime handles 'Z' suffix, unlike LocalDateTime)
            java.time.ZonedDateTime zStart = java.time.ZonedDateTime.parse(start);
            java.time.ZonedDateTime zEnd = java.time.ZonedDateTime.parse(end);
            return ResponseEntity.ok(controllerReadingService.getByControllerIdAndDateRange(id, zStart.toLocalDateTime(), zEnd.toLocalDateTime(), PageRequest.of(page, size, Sort.by("createdAt").descending())));
        } catch (Exception e) {
            log.error("Invalid date format: " + e.getMessage());
            // Fallback to LocalDateTime parsing if ZonedDateTime fails (e.g. no timezone)
            try {
                java.time.LocalDateTime lStart = java.time.LocalDateTime.parse(start);
                java.time.LocalDateTime lEnd = java.time.LocalDateTime.parse(end);
                return ResponseEntity.ok(controllerReadingService.getByControllerIdAndDateRange(id, lStart, lEnd, PageRequest.of(page, size, Sort.by("createdAt").descending())));
            } catch (Exception ex) {
                log.error("Fallback parsing failed", ex);
                return ResponseEntity.badRequest().build();
            }
        }
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
