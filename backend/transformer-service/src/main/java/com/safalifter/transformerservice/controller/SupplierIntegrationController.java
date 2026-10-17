package com.safalifter.transformerservice.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safalifter.transformerservice.config.AccessScopeService;
import com.safalifter.transformerservice.entities.SupplierIntegration;
import com.safalifter.transformerservice.ingest.framework.DecodedUplink;
import com.safalifter.transformerservice.ingest.framework.SupplierConnectionManager;
import com.safalifter.transformerservice.ingest.framework.TelemetryPipeline;
import com.safalifter.transformerservice.ingest.framework.UplinkDecoder;
import com.safalifter.transformerservice.repository.SupplierIntegrationRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Admin screen backend for partner telemetry feeds: one row per supplier connection, each with
 * its own decoder. Changes take effect within 30 s (SupplierConnectionManager reconciles).
 */
@Tag(name = "Supplier Integrations")
@RestController
@RequiredArgsConstructor
public class SupplierIntegrationController {

    private static final Set<String> TRANSPORTS = Set.of("LORIOT_WEBSOCKET", "HTTP_PUSH");
    private static final SecureRandom RANDOM = new SecureRandom();

    private final SupplierIntegrationRepository repository;
    private final TelemetryPipeline pipeline;
    private final SupplierConnectionManager connectionManager;
    private final AccessScopeService accessScopeService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Data
    public static class IntegrationRequest {
        private String supplierCode;
        private String supplierName;
        private String name;
        private String transport;
        /** Leave blank on update to keep the stored URL (it is never sent back unmasked). */
        private String endpointUrl;
        private String decoderKey;
        private String defaultControllerType;
        private Boolean autoRegister;
        private Boolean enabled;
        private Boolean regenerateSecret;
    }

    @Data
    public static class TestDecodeRequest {
        private String decoderKey;
        private String payloadHex;
        private Integer port;
        /** Optional full network-server message JSON, for decoders that read pre-decoded fields. */
        private String messageJson;
    }

    @GetMapping("/api/v1/supplier-integrations")
    public ResponseEntity<List<Map<String, Object>>> list() {
        requireManage(false);
        return ResponseEntity.ok(repository.findAllByOrderBySupplierCodeAscNameAsc().stream().map(this::view).toList());
    }

    @GetMapping("/api/v1/supplier-integrations/decoders")
    public ResponseEntity<List<Map<String, String>>> decoders() {
        requireManage(false);
        List<Map<String, String>> out = new ArrayList<>();
        pipeline.decoderMap().values().forEach(d -> out.add(Map.of("key", d.key(), "label", d.label())));
        return ResponseEntity.ok(out);
    }

    @PostMapping("/api/v1/supplier-integrations")
    public ResponseEntity<Map<String, Object>> create(@RequestBody IntegrationRequest request) {
        requireManage(true);
        SupplierIntegration integ = new SupplierIntegration();
        integ.setMessagesReceived(0);
        integ.setDevicesRegistered(0);
        apply(integ, request, true);
        return ResponseEntity.status(HttpStatus.CREATED).body(view(repository.save(integ)));
    }

    @PutMapping("/api/v1/supplier-integrations/{id}")
    public ResponseEntity<Map<String, Object>> update(@PathVariable Long id, @RequestBody IntegrationRequest request) {
        requireManage(true);
        SupplierIntegration integ = repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Integration not found"));
        apply(integ, request, false);
        return ResponseEntity.ok(view(repository.save(integ)));
    }

    @DeleteMapping("/api/v1/supplier-integrations/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        requireManage(true);
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/v1/supplier-integrations/test-decode")
    @Operation(summary = "Run a decoder against a sample payload (for engineers onboarding a partner's devices)")
    public ResponseEntity<Map<String, Object>> testDecode(@RequestBody TestDecodeRequest request) {
        requireManage(false);
        UplinkDecoder decoder = pipeline.decoder(request.getDecoderKey())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown decoder"));
        JsonNode message = null;
        try {
            if (request.getMessageJson() != null && !request.getMessageJson().isBlank()) {
                message = objectMapper.readTree(request.getMessageJson());
            }
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Message JSON is not valid JSON");
        }
        String hex = request.getPayloadHex();
        if ((hex == null || hex.isBlank()) && message != null) {
            hex = message.path("data").asText(null);
        }
        DecodedUplink decoded = decoder.decode(TelemetryPipeline.parseHex(hex), request.getPort() != null ? request.getPort() : 2, message);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("motion", decoded.primaryTrigger());
        out.put("doorOrVibration", decoded.secondaryTrigger());
        out.put("battery", decoded.battery());
        out.put("fields", decoded.fields());
        return ResponseEntity.ok(out);
    }

    /**
     * HTTP push for partners that cannot hold a websocket: POST the network-server JSON here.
     * Authenticated by the integration's push secret (?key= or X-Integration-Key header).
     */
    @PostMapping("/api/v1/public/ingest/{integrationId}")
    public ResponseEntity<Map<String, Object>> push(@PathVariable Long integrationId,
                                                    @RequestParam(value = "key", required = false) String key,
                                                    @RequestHeader(value = "X-Integration-Key", required = false) String headerKey,
                                                    @RequestBody String body) {
        SupplierIntegration integ = repository.findById(integrationId).filter(SupplierIntegration::isEnabled)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown integration"));
        String supplied = headerKey != null ? headerKey : key;
        if (integ.getPushSecret() == null || supplied == null || !constantTimeEquals(integ.getPushSecret(), supplied)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid integration key");
        }
        try {
            JsonNode root = objectMapper.readTree(body);
            List<String> results = new ArrayList<>();
            if (root.isArray()) {
                for (JsonNode n : root) results.add(pipeline.ingest(integ, n, n.toString()).name());
            } else {
                results.add(pipeline.ingest(integ, root, body).name());
            }
            return ResponseEntity.ok(Map.of("results", results));
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not process message: " + e.getMessage());
        }
    }

    private void apply(SupplierIntegration integ, IntegrationRequest r, boolean creating) {
        String supplierCode = trim(r.getSupplierCode());
        if (supplierCode == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Supplier code is required");
        String transport = trim(r.getTransport()) == null ? "LORIOT_WEBSOCKET" : r.getTransport().trim().toUpperCase(Locale.ROOT);
        if (!TRANSPORTS.contains(transport)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Transport must be LORIOT_WEBSOCKET or HTTP_PUSH");
        if (r.getDecoderKey() == null || pipeline.decoder(r.getDecoderKey()).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a decoder");
        }
        integ.setSupplierCode(supplierCode.toLowerCase(Locale.ROOT));
        integ.setSupplierName(trim(r.getSupplierName()) != null ? r.getSupplierName().trim() : supplierCode);
        integ.setName(trim(r.getName()) != null ? r.getName().trim() : integ.getSupplierName() + " feed");
        integ.setTransport(transport);
        String url = trim(r.getEndpointUrl());
        if (url != null) {
            if (!url.startsWith("wss://") && !url.startsWith("ws://")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Websocket URL must start with wss://");
            }
            integ.setEndpointUrl(url);
        }
        if ("LORIOT_WEBSOCKET".equals(transport) && integ.getEndpointUrl() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Websocket URL is required");
        }
        integ.setDecoderKey(r.getDecoderKey());
        integ.setDefaultControllerType(trim(r.getDefaultControllerType()));
        if (r.getAutoRegister() != null) integ.setAutoRegister(r.getAutoRegister());
        if (r.getEnabled() != null) integ.setEnabled(r.getEnabled());
        if ("HTTP_PUSH".equals(transport) && (integ.getPushSecret() == null || Boolean.TRUE.equals(r.getRegenerateSecret()))) {
            byte[] b = new byte[24];
            RANDOM.nextBytes(b);
            integ.setPushSecret(HexFormat.of().formatHex(b));
        }
        if (creating) integ.setStatus(integ.isEnabled() ? "PENDING" : "STOPPED");
    }

    private Map<String, Object> view(SupplierIntegration i) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", i.getId());
        m.put("supplierCode", i.getSupplierCode());
        m.put("supplierName", i.getSupplierName());
        m.put("name", i.getName());
        m.put("transport", i.getTransport());
        m.put("endpointUrlMasked", mask(i.getEndpointUrl()));
        m.put("pushPath", "HTTP_PUSH".equals(i.getTransport()) ? "/api/v1/public/ingest/" + i.getId() : null);
        m.put("pushSecret", "HTTP_PUSH".equals(i.getTransport()) ? i.getPushSecret() : null);
        m.put("decoderKey", i.getDecoderKey());
        m.put("defaultControllerType", i.getDefaultControllerType());
        m.put("autoRegister", i.isAutoRegister());
        m.put("enabled", i.isEnabled());
        m.put("status", "HTTP_PUSH".equals(i.getTransport()) ? (i.isEnabled() ? "LISTENING" : "STOPPED")
                : (connectionManager.isConnected(i.getId()) ? "CONNECTED" : i.getStatus()));
        m.put("lastError", i.getLastError());
        m.put("lastConnectedAt", i.getLastConnectedAt());
        m.put("lastMessageAt", i.getLastMessageAt());
        m.put("messagesReceived", i.getMessagesReceived());
        m.put("devicesRegistered", i.getDevicesRegistered());
        m.put("updatedAt", i.getUpdatedAt());
        return m;
    }

    /** wss://eu1.loriot.io/app?token=vgEA...  ->  wss://eu1.loriot.io/app?token=vgEA…•••• */
    private static String mask(String url) {
        if (url == null) return null;
        int t = url.indexOf("token=");
        if (t < 0) return url.length() > 40 ? url.substring(0, 40) + "…" : url;
        int start = t + 6;
        return url.substring(0, Math.min(url.length(), start + 4)) + "••••••••";
    }

    private void requireManage(boolean write) {
        if (accessScopeService.isSupplierScoped()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Partner accounts cannot manage integrations");
        }
        String needed = write ? "integrations.manage" : "integrations.read";
        if (!accessScopeService.hasPermission(needed) && !accessScopeService.hasPermission("integrations.manage")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Missing permission: " + needed);
        }
    }

    private static boolean constantTimeEquals(String a, String b) {
        return java.security.MessageDigest.isEqual(a.getBytes(java.nio.charset.StandardCharsets.UTF_8), b.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    private static String trim(String v) {
        if (v == null) return null;
        String t = v.trim();
        return t.isEmpty() ? null : t;
    }
}
