package com.safalifter.transformerservice.controller;

import com.safalifter.transformerservice.ingest.LoriotWebSocketIngestor;
import com.safalifter.transformerservice.ingest.OculusWebSocketIngestor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Tag(name = "WebSocket Ingestion Status")
@RestController
@RequestMapping("/api/v1/ws-ingest")
@RequiredArgsConstructor
@Slf4j
public class WsIngestStatusController {

    private final ObjectProvider<LoriotWebSocketIngestor> loriotIngestorProvider;
    private final ObjectProvider<OculusWebSocketIngestor> oculusIngestorProvider;

    @GetMapping("/status")
    @Operation(summary = "Get WebSocket ingestion connection liveness status")
    @PreAuthorize("hasAuthority('READ_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','MANAGINGDIRECTOR','DISTRICTMANAGER','TECHNICALDIRECTOR','FINANCEDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER')")
    public ResponseEntity<Map<String, Object>> getStatus() {
        Map<String, Object> body = new LinkedHashMap<>();
        List<Map<String, Object>> ingestors = new ArrayList<>();

        LoriotWebSocketIngestor loriot = loriotIngestorProvider.getIfAvailable();
        if (loriot != null) {
            ingestors.add(loriot.getStatusSnapshot());
        } else {
            Map<String, Object> disabled = new LinkedHashMap<>();
            disabled.put("supplier", "loriot");
            disabled.put("enabled", false);
            ingestors.add(disabled);
        }

        OculusWebSocketIngestor oculus = oculusIngestorProvider.getIfAvailable();
        if (oculus != null) {
            ingestors.add(oculus.getStatusSnapshot());
        } else {
            Map<String, Object> disabled = new LinkedHashMap<>();
            disabled.put("supplier", "oculus");
            disabled.put("enabled", false);
            ingestors.add(disabled);
        }

        body.put("ingestors", ingestors);
        body.put("overallConnected", ingestors.stream()
                .filter(i -> Boolean.TRUE.equals(i.get("enabled")))
                .allMatch(i -> Boolean.TRUE.equals(i.get("connected"))));
        body.put("timestamp", java.time.Instant.now().toString());

        return ResponseEntity.ok(body);
    }
}
