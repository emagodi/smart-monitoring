package com.safalifter.transformerservice.controller.gateway;

import com.safalifter.transformerservice.entities.GatewaySyncRun;
import com.safalifter.transformerservice.enums.GatewayStatus;
import com.safalifter.transformerservice.payload.request.gateway.*;
import com.safalifter.transformerservice.payload.response.gateway.*;
import com.safalifter.transformerservice.repository.GatewaySyncRunRepository;
import com.safalifter.transformerservice.service.GatewayService;
import com.safalifter.transformerservice.service.LoriotGatewaySyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

@Tag(name = "Gateway Endpoints")
@RestController
@RequestMapping("/api/v1/gateways")
@RequiredArgsConstructor
public class GatewayController {

    private final GatewayService gatewayService;
    private final LoriotGatewaySyncService syncService;
    private final GatewaySyncRunRepository syncRunRepository;

    @GetMapping("/summary")
    @Operation(summary = "Gateway summary counts")
    @PreAuthorize("hasAuthority('gateways.view') OR hasAuthority('READ_PRIVILEGE') OR hasRole('ADMINISTRATOR') OR hasRole('ADMIN')")
    public ResponseEntity<GatewaySummaryResponse> summary() {
        return ResponseEntity.ok(gatewayService.getSummary());
    }

    @GetMapping
    @Operation(summary = "List gateways paginated with filters")
    @PreAuthorize("hasAuthority('gateways.view') OR hasAuthority('READ_PRIVILEGE') OR hasRole('ADMINISTRATOR') OR hasRole('ADMIN')")
    public ResponseEntity<Page<GatewayResponse>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String networkId,
            @RequestParam(required = false) String model,
            @RequestParam(required = false) Long regionId,
            @RequestParam(required = false) Long districtId,
            @RequestParam(required = false) Long depotId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant lastSeenFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant lastSeenTo,
            @PageableDefault(size = 25, sort = "id", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        GatewayListFilterRequest filter = new GatewayListFilterRequest();
        if (status != null && !status.isBlank()) {
            try {
                filter.setStatus(GatewayStatus.valueOf(status.trim().toUpperCase()));
            } catch (Exception ignored) {
            }
        }
        filter.setSearch(search);
        filter.setNetworkId(networkId);
        filter.setModel(model);
        filter.setRegionId(regionId);
        filter.setDistrictId(districtId);
        filter.setDepotId(depotId);
        filter.setLastSeenFrom(lastSeenFrom);
        filter.setLastSeenTo(lastSeenTo);
        return ResponseEntity.ok(gatewayService.findPage(filter, pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get gateway by id")
    @PreAuthorize("hasAuthority('gateways.view') OR hasAuthority('READ_PRIVILEGE') OR hasRole('ADMINISTRATOR') OR hasRole('ADMIN')")
    public ResponseEntity<GatewayResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(gatewayService.getById(id));
    }

    @PostMapping
    @Operation(summary = "Create manual gateway")
    @PreAuthorize("(hasAuthority('gateways.create') OR hasAuthority('WRITE_PRIVILEGE') OR hasRole('ADMINISTRATOR') OR hasRole('ADMIN'))")
    public ResponseEntity<GatewayResponse> create(@Valid @RequestBody GatewayCreateRequest request) {
        GatewayResponse saved = gatewayService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update gateway manual fields")
    @PreAuthorize("(hasAuthority('gateways.edit') OR hasAuthority('UPDATE_PRIVILEGE') OR hasRole('ADMINISTRATOR') OR hasRole('ADMIN'))")
    public ResponseEntity<GatewayResponse> update(@PathVariable Long id, @Valid @RequestBody GatewayUpdateRequest request) {
        return ResponseEntity.ok(gatewayService.update(id, request));
    }

    @PostMapping("/{id}/decommission")
    @Operation(summary = "Decommission gateway")
    @PreAuthorize("(hasAuthority('gateways.edit') OR hasAuthority('DELETE_PRIVILEGE') OR hasRole('ADMINISTRATOR') OR hasRole('ADMIN'))")
    public ResponseEntity<Void> decommission(@PathVariable Long id, @Valid @RequestBody GatewayDecommissionRequest request) {
        gatewayService.decommission(id, request);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/sync")
    @Operation(summary = "Trigger manual LORIOT gateway sync")
    @PreAuthorize("(hasAuthority('gateways.sync') OR hasAuthority('WRITE_PRIVILEGE') OR hasRole('ADMINISTRATOR') OR hasRole('ADMIN'))")
    public ResponseEntity<GatewaySyncTriggerResponse> triggerSync() {
        Long runId = syncService.triggerManualSync();
        GatewaySyncRun run = syncRunRepository.findById(runId).orElse(null);
        return ResponseEntity.accepted().body(GatewaySyncTriggerResponse.builder()
                .syncRunId(runId)
                .startedAt(run != null ? run.getStartedAt() : null)
                .status(run != null ? run.getStatus().name() : null)
                .build());
    }

    @GetMapping("/sync/status")
    @Operation(summary = "Last gateway sync runs")
    @PreAuthorize("hasAuthority('gateways.view') OR hasAuthority('READ_PRIVILEGE') OR hasRole('ADMINISTRATOR') OR hasRole('ADMIN')")
    public ResponseEntity<List<GatewaySyncRun>> syncStatus() {
        return ResponseEntity.ok(syncRunRepository.findTop5ByOrderByStartedAtDesc());
    }

    @GetMapping("/{id}/status-history")
    @Operation(summary = "Paginated gateway status history")
    @PreAuthorize("(hasAuthority('gateways.audit_view') OR hasAuthority('gateways.view') OR hasAuthority('READ_PRIVILEGE') OR hasRole('ADMINISTRATOR') OR hasRole('ADMIN'))")
    public ResponseEntity<Page<GatewayStatusHistoryResponse>> statusHistory(
            @PathVariable Long id,
            @PageableDefault(size = 50, sort = "id", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return ResponseEntity.ok(gatewayService.getStatusHistory(id, pageable));
    }

    @GetMapping("/map")
    @Operation(summary = "Gateway map points with secrets stripped")
    @PreAuthorize("hasAuthority('gateways.view') OR hasAuthority('READ_PRIVILEGE') OR hasRole('ADMINISTRATOR') OR hasRole('ADMIN')")
    public ResponseEntity<List<GatewayMapPointResponse>> mapPoints() {
        return ResponseEntity.ok(gatewayService.getMapPoints());
    }
}
