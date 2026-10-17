package com.safalifter.transformerservice.controller;

import com.safalifter.transformerservice.service.InsightsService;
import com.safalifter.transformerservice.service.MapService;
import com.safalifter.transformerservice.service.RegistryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

/** Transformer registry, EUI import, controller matching and dashboard roll-ups. */
@Tag(name = "Transformer Registry")
@RestController
@RequiredArgsConstructor
public class RegistryController {

    private final RegistryService registryService;
    private final InsightsService insightsService;
    private final MapService mapService;

    @Data
    public static class AssignRequest {
        private Long transformerId;
    }

    @GetMapping("/api/v1/transformers/registry")
    @Operation(summary = "All transformers in scope with devices, live status and alert counts (one query)")
    public ResponseEntity<List<RegistryService.RegistryRow>> registry() {
        return ResponseEntity.ok(registryService.scopedRows());
    }

    @GetMapping("/api/v1/transformers/registry/{id}")
    public ResponseEntity<RegistryService.RegistryRow> registryRow(@PathVariable Long id) {
        return registryService.registry(id).stream().findFirst().map(ResponseEntity::ok)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer not found"));
    }

    @GetMapping("/api/v1/transformers/stats")
    @Operation(summary = "Headline figures for the dashboard (scoped to the caller, cached briefly)")
    public ResponseEntity<Map<String, Object>> stats() {
        return ResponseEntity.ok(mapService.stats());
    }

    @GetMapping("/api/v1/transformers/map")
    @Operation(summary = "Transformers in the visible map area (or matching a search), grouped when there are too many to draw")
    public ResponseEntity<Map<String, Object>> map(@RequestParam(required = false) Double south,
                                                   @RequestParam(required = false) Double west,
                                                   @RequestParam(required = false) Double north,
                                                   @RequestParam(required = false) Double east,
                                                   @RequestParam(required = false) Integer zoom,
                                                   @RequestParam(required = false) String status,
                                                   @RequestParam(required = false) String q) {
        return ResponseEntity.ok(mapService.map(south, west, north, east, zoom, status, q));
    }

    @GetMapping("/api/v1/transformers/overview")
    @Operation(summary = "Per-partner and per-depot roll-ups for dashboards (scoped to the caller)")
    public ResponseEntity<Map<String, Object>> overview() {
        return ResponseEntity.ok(insightsService.overview());
    }

    @GetMapping("/api/v1/transformers/import-eui/preview")
    @Operation(summary = "Look a device EUI up at the partner and in our controller list before importing")
    public ResponseEntity<Map<String, Object>> preview(@RequestParam String eui) {
        return ResponseEntity.ok(registryService.previewEui(eui));
    }

    @PostMapping("/api/v1/transformers/import-eui")
    @Operation(summary = "Create a transformer from a partner EUI lookup in the chosen depot and link its controller")
    public ResponseEntity<RegistryService.RegistryRow> importEui(@RequestBody RegistryService.ImportRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(registryService.importFromEui(request));
    }

    @GetMapping("/api/v1/controllers/unmatched")
    @Operation(summary = "Controllers that reported in (auto-registered by an ingest feed) but have no transformer yet")
    public ResponseEntity<List<Map<String, Object>>> unmatched() {
        return ResponseEntity.ok(registryService.unmatchedControllers());
    }

    @PostMapping("/api/v1/controllers/{id}/assign")
    public ResponseEntity<RegistryService.RegistryRow> assign(@PathVariable Long id, @RequestBody AssignRequest request,
                                                              @RequestParam(name = "move", defaultValue = "false") boolean move) {
        if (request == null || request.getTransformerId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a transformer");
        }
        // move=true moves a controller that is linked to the wrong transformer in one step.
        return ResponseEntity.ok(registryService.assign(id, request.getTransformerId(), move));
    }

    @PostMapping("/api/v1/controllers/{id}/unassign")
    public ResponseEntity<Void> unassign(@PathVariable Long id) {
        registryService.unassign(id);
        return ResponseEntity.noContent().build();
    }
}
