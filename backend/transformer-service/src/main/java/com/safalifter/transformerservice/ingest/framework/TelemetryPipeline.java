package com.safalifter.transformerservice.ingest.framework;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safalifter.transformerservice.entities.Controller;
import com.safalifter.transformerservice.entities.ControllerReading;
import com.safalifter.transformerservice.entities.SupplierIntegration;
import com.safalifter.transformerservice.repository.ControllerRepository;
import com.safalifter.transformerservice.repository.SupplierIntegrationRepository;
import com.safalifter.transformerservice.service.ControllerReadingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The single path from "a partner network server sent us an uplink" to "a controller reading
 * exists and the alert engine has seen it". Every transport (LORIOT websocket, HTTP push) and
 * every supplier goes through here, so de-duplication, controller auto-registration and alerting
 * behave identically for all partners.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class TelemetryPipeline {

    private static final int DEDUPE_CAPACITY = 20_000;

    private final List<UplinkDecoder> decoders;
    private final ControllerRepository controllerRepository;
    private final ControllerReadingService controllerReadingService;
    private final SupplierIntegrationRepository integrationRepository;
    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** LORIOT emits the same uplink as both "gw" and "rx"; remember recent (EUI, fcnt/seqno) keys. */
    private final Map<String, Boolean> recent = java.util.Collections.synchronizedMap(new LinkedHashMap<>(1024, 0.75f, false) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Boolean> eldest) {
            return size() > DEDUPE_CAPACITY;
        }
    });

    public Map<String, UplinkDecoder> decoderMap() {
        return decoders.stream().collect(Collectors.toMap(UplinkDecoder::key, Function.identity(), (a, b) -> a, LinkedHashMap::new));
    }

    public Optional<UplinkDecoder> decoder(String key) {
        return Optional.ofNullable(decoderMap().get(key));
    }

    public enum Result { STORED, DUPLICATE, IGNORED, UNKNOWN_DEVICE }

    /**
     * Ingest one network-server message (LORIOT format: cmd, EUI, port, data hex, fcnt, gws[], bat).
     * Also accepts {"devEui": ..., "fPort": ..., "data": ...} style HTTP pushes.
     */
    public Result ingest(SupplierIntegration integration, JsonNode msg, String rawJson) {
        String cmd = msg.path("cmd").asText("");
        if (!cmd.isEmpty() && !cmd.equals("gw") && !cmd.equals("rx") && !cmd.equals("uplink")) {
            return Result.IGNORED; // tx acks, gw status, etc.
        }
        String eui = text(msg, "EUI", "devEui", "deveui", "DevEUI", "eui");
        if (eui == null) {
            return Result.IGNORED;
        }
        eui = eui.trim().toUpperCase(Locale.ROOT);
        String frame = text(msg, "fcnt", "fCnt", "seqno");
        if (frame != null) {
            String key = integration.getSupplierCode() + ":" + eui + ":" + frame;
            if (recent.putIfAbsent(key, Boolean.TRUE) != null) {
                return Result.DUPLICATE;
            }
        }

        UplinkDecoder decoder = decoder(integration.getDecoderKey())
                .orElseThrow(() -> new IllegalStateException("Unknown decoder " + integration.getDecoderKey()));
        int port = msg.has("port") ? msg.path("port").asInt(0) : msg.path("fPort").asInt(0);
        byte[] bytes = parseHex(text(msg, "data", "payload_hex"));
        DecodedUplink decoded = decoder.decode(bytes, port, msg);

        Controller controller = resolveController(integration, eui);
        if (controller == null) {
            touch(integration, false);
            return Result.UNKNOWN_DEVICE;
        }

        int rssi = msg.path("rssi").asInt(0);
        int snr = msg.path("snr").asInt(0);
        if (msg.path("gws").isArray() && msg.path("gws").size() > 0) {
            JsonNode gw0 = msg.path("gws").get(0);
            rssi = gw0.path("rssi").asInt(rssi);
            snr = (int) Math.round(gw0.path("snr").asDouble(snr));
        }

        String decodedJson;
        try {
            Map<String, Object> out = new LinkedHashMap<>(decoded.fields());
            out.put("_decoder", decoder.key());
            out.put("_supplier", integration.getSupplierCode());
            decodedJson = objectMapper.writeValueAsString(out);
        } catch (Exception e) {
            decodedJson = "{}";
        }

        controllerReadingService.save(ControllerReading.builder()
                .controllerId(controller.getId())
                .rawPayload(rawJson)
                .decodedPayload(decodedJson)
                .di1(decoded.primaryTrigger())
                .di2(decoded.secondaryTrigger())
                .battery(decoded.battery())
                .rssi(rssi)
                .snr(snr)
                .build());
        touch(integration, false);
        return Result.STORED;
    }

    private Controller resolveController(SupplierIntegration integration, String eui) {
        Optional<Controller> existing = controllerRepository.findByDevEuiAndSupplierCode(eui, integration.getSupplierCode());
        if (existing.isEmpty()) {
            existing = controllerRepository.findAllByDevEuiIgnoreCase(eui).stream()
                    .filter(c -> integration.getSupplierCode().equalsIgnoreCase(String.valueOf(c.getSupplierCode())))
                    .findFirst();
        }
        if (existing.isPresent()) {
            return existing.get();
        }
        if (!integration.isAutoRegister()) {
            return null;
        }
        // New device: lands in the "unmatched controllers" queue (no transformer yet).
        Controller created = controllerRepository.save(Controller.builder()
                .devEui(eui)
                .deviceId(eui)
                .name("Controller " + eui)
                .type(integration.getDefaultControllerType())
                .supplierCode(integration.getSupplierCode())
                .supplierName(integration.getSupplierName())
                .build());
        log.info("Auto-registered controller {} for supplier {} (awaiting transformer match)", eui, integration.getSupplierCode());
        bumpDevices(integration);
        return created;
    }

    private void bumpDevices(SupplierIntegration integration) {
        if (integration.getId() == null) return;
        try {
            jdbc.update("UPDATE supplier_integrations SET devices_registered = devices_registered + 1 WHERE id = :id",
                    new MapSqlParameterSource("id", integration.getId()));
        } catch (Exception ignored) {
        }
    }

    /** Lightweight counters without loading/saving the entity on every message. */
    private void touch(SupplierIntegration integration, boolean unusedFlag) {
        if (integration.getId() == null) return;
        try {
            jdbc.update("UPDATE supplier_integrations SET last_message_at = :now, messages_received = messages_received + 1"
                            + " WHERE id = :id",
                    new MapSqlParameterSource().addValue("now", java.sql.Timestamp.valueOf(LocalDateTime.now())).addValue("id", integration.getId()));
        } catch (Exception ignored) {
        }
    }

    public static byte[] parseHex(String hex) {
        if (hex == null || hex.isBlank()) return new byte[0];
        String clean = hex.trim();
        if (clean.length() % 2 != 0 || !clean.matches("[0-9a-fA-F]+")) {
            // LORIOT can also be configured to send base64
            try {
                return java.util.Base64.getDecoder().decode(clean);
            } catch (Exception e) {
                return new byte[0];
            }
        }
        return HexFormat.of().parseHex(clean);
    }

    private static String text(JsonNode msg, String... keys) {
        for (String k : keys) {
            JsonNode v = msg.path(k);
            if (!v.isMissingNode() && !v.isNull() && !v.asText("").isBlank()) {
                return v.asText();
            }
        }
        return null;
    }
}
