package com.safalifter.transformerservice.reaction;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safalifter.transformerservice.config.AccessScopeService;
import com.safalifter.transformerservice.service.GatewayStatusService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static com.safalifter.transformerservice.lifecycle.LifecycleService.camel;

/**
 * Which gateway(s) each controller is heard through. Every LoRaWAN uplink lists the gateways that received it (gws[],
 * with RSSI / SNR); we remember them per controller, so a gateway shows the transformers it serves and a transformer
 * shows the gateway it reports through (the one that heard it most recently / strongest).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GatewayLinkService {

    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final AccessScopeService scope;

    private record Heard(String eui, Integer rssi, Double snr) {}

    /** Called for every stored reading. Never throws. */
    public void learn(Long controllerId, String rawPayload, LocalDateTime at) {
        if (controllerId == null || rawPayload == null || rawPayload.isBlank() || !rawPayload.contains("gw")) return;
        try {
            List<Heard> heard = parse(rawPayload);
            if (heard.isEmpty()) return;
            Timestamp ts = Timestamp.valueOf(at != null ? at : LocalDateTime.now());
            for (Heard h : heard) {
                jdbc.update("""
                        INSERT INTO controller_gateway_links (controller_id, gateway_eui, first_heard_at, last_heard_at, last_rssi, last_snr, uplinks)
                        VALUES (:c, :g, :t, :t, :r, :s, 1)
                        ON DUPLICATE KEY UPDATE uplinks = uplinks + 1,
                            last_rssi = IF(:t >= last_heard_at OR last_heard_at IS NULL, :r, last_rssi),
                            last_snr = IF(:t >= last_heard_at OR last_heard_at IS NULL, :s, last_snr),
                            last_heard_at = GREATEST(COALESCE(last_heard_at, :t), :t),
                            first_heard_at = LEAST(COALESCE(first_heard_at, :t), :t)""",
                        new MapSqlParameterSource().addValue("c", controllerId).addValue("g", h.eui()).addValue("t", ts)
                                .addValue("r", h.rssi()).addValue("s", h.snr()));
            }
        } catch (Exception e) {
            log.debug("Gateway link not learnt for controller {}: {}", controllerId, e.getMessage());
        }
    }

    private List<Heard> parse(String raw) throws Exception {
        JsonNode root = objectMapper.readTree(raw);
        List<Heard> out = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (String k : new String[]{"gws", "rxq", "rxInfo", "rx_metadata"}) {
            JsonNode arr = root.path(k);
            if (!arr.isArray()) continue;
            for (JsonNode g : arr) {
                String eui = text(g, "gweui", "gwEui", "gatewayEui", "gateway_eui", "gatewayID", "gatewayId", "EUI", "eui", "mac");
                if (eui == null && g.path("gateway_ids").isObject()) eui = text(g.path("gateway_ids"), "eui", "gateway_id");
                String n = GatewayStatusService.normalizeEui(eui);
                if (n == null || n.length() < 8 || !seen.add(n)) continue;
                Integer rssi = g.has("rssi") ? g.path("rssi").asInt() : null;
                Double snr = g.has("snr") ? g.path("snr").asDouble() : g.has("loRaSNR") ? g.path("loRaSNR").asDouble() : null;
                out.add(new Heard(n, rssi, snr));
            }
        }
        String rootEui = GatewayStatusService.normalizeEui(text(root, "gweui", "gwEui", "gatewayEui"));
        if (rootEui != null && rootEui.length() >= 8 && seen.add(rootEui)) {
            out.add(new Heard(rootEui, root.has("rssi") ? root.path("rssi").asInt() : null, root.has("snr") ? root.path("snr").asDouble() : null));
        }
        return out;
    }

    private static String text(JsonNode n, String... keys) {
        for (String k : keys) {
            JsonNode v = n.path(k);
            if (v.isTextual() && !v.asText().isBlank()) return v.asText();
        }
        return null;
    }

    /** First start: learn from the readings already stored (last 30 days), in the background. */
    @EventListener(ApplicationReadyEvent.class)
    @Async
    public void backfill() {
        try {
            Long have = jdbc.queryForObject("SELECT COUNT(*) FROM controller_gateway_links", Map.of(), Long.class);
            if (have != null && have > 0) return;
            long lastId = 0;
            int learnt = 0;
            Timestamp since = Timestamp.valueOf(LocalDateTime.now().minusDays(30));
            while (true) {
                List<Map<String, Object>> rows = jdbc.queryForList("""
                        SELECT id, controller_id, raw_payload, created_at FROM controller_readings
                         WHERE id > :last AND created_at >= :since AND raw_payload LIKE '%gw%' ORDER BY id LIMIT 2000""",
                        new MapSqlParameterSource("last", lastId).addValue("since", since));
                if (rows.isEmpty()) break;
                for (Map<String, Object> r : rows) {
                    lastId = ((Number) r.get("id")).longValue();
                    Object c = r.get("controller_id");
                    Object at = r.get("created_at");
                    LocalDateTime t = at instanceof Timestamp ts ? ts.toLocalDateTime() : at instanceof LocalDateTime l ? l : null;
                    if (c != null) {
                        learn(((Number) c).longValue(), (String) r.get("raw_payload"), t);
                        learnt++;
                    }
                }
            }
            if (learnt > 0) log.info("Gateway links learnt from {} stored readings", learnt);
        } catch (Exception e) {
            log.warn("Gateway link back-fill skipped: {}", e.getMessage());
        }
    }

    // ------------------------------------------------------------------ queries

    /** Transformers heard through this gateway (learnt from uplinks), plus any linked by hand (coverage). */
    public Map<String, Object> transformersOf(long gatewayId) {
        if (!scope.hasPermission("gateways.view") && !scope.hasPermission("transformers.read")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot view gateways");
        }
        List<Map<String, Object>> g = jdbc.queryForList("SELECT id, name, normalized_gateway_eui, effective_status, depot_id FROM gateways WHERE id = :id", Map.of("id", gatewayId));
        if (g.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Gateway not found");
        String eui = (String) g.get(0).get("normalized_gateway_eui");
        MapSqlParameterSource p = new MapSqlParameterSource("eui", eui == null ? "-" : eui).addValue("gid", gatewayId)
                .addValue("recent", Timestamp.valueOf(LocalDateTime.now().minusDays(7)));
        StringBuilder w = new StringBuilder();
        if (scope.getCurrentDepotId() != null) { w.append(" AND t.depot_id = :scopeDepot"); p.addValue("scopeDepot", scope.getCurrentDepotId()); }
        if (scope.isSupplierScoped()) { w.append(" AND (LOWER(t.supplier_code) = LOWER(:scopeSup) OR LOWER(c.supplier_code) = LOWER(:scopeSup))"); p.addValue("scopeSup", scope.getCurrentSupplierCode()); }
        List<Map<String, Object>> heard = jdbc.queryForList("""
                SELECT t.id AS transformer_id, t.name AS transformer_name, t.transformer_number, t.depot_id, t.last_telemetry_at,
                       COALESCE(t.supplier_name, c.supplier_name) AS supplier_name, c.dev_eui, l.last_heard_at, l.first_heard_at, l.last_rssi, l.last_snr, l.uplinks,
                       (SELECT COUNT(*) FROM controller_gateway_links o WHERE o.controller_id = l.controller_id AND o.last_heard_at >= :recent) AS gateways_hearing,
                       'UPLINK' AS source
                  FROM controller_gateway_links l
                  JOIN controllers c ON c.id = l.controller_id
                  JOIN transformers t ON t.id = c.transformer_id
                 WHERE l.gateway_eui = :eui""" + w + " ORDER BY l.last_heard_at DESC", p);
        List<Map<String, Object>> out = new ArrayList<>(heard.stream().map(r -> camel(r)).toList());
        Set<Object> ids = new LinkedHashSet<>();
        out.forEach(r -> ids.add(r.get("transformerId")));
        try {
            jdbc.queryForList("""
                    SELECT t.id AS transformer_id, t.name AS transformer_name, t.transformer_number, t.depot_id, t.last_telemetry_at,
                           t.supplier_name, cv.notes, 'MANUAL' AS source
                      FROM gateway_transformer_coverage cv JOIN transformers t ON t.id = cv.transformer_id
                      LEFT JOIN controllers c ON c.transformer_id = t.id
                     WHERE cv.gateway_id = :gid""" + w, p)
                    .forEach(r -> { if (ids.add(r.get("transformer_id"))) out.add(camel(r)); });
        } catch (Exception ignored) {
            // coverage table not present
        }
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("gateway", camel(g.get(0)));
        res.put("transformers", out);
        return res;
    }

    /** Transformer id -> the gateway it reports through (most recently heard; strongest signal on ties). */
    public Map<Long, Map<String, Object>> gatewayByTransformer() {
        Map<Long, Map<String, Object>> out = new LinkedHashMap<>();
        jdbc.query("""
                SELECT c.transformer_id, g.id AS gateway_id, g.name, g.effective_status, l.last_heard_at, l.last_rssi, l.last_snr,
                       (SELECT COUNT(DISTINCT o.gateway_eui) FROM controller_gateway_links o JOIN controllers oc ON oc.id = o.controller_id
                         WHERE oc.transformer_id = c.transformer_id) AS gateway_count
                  FROM controller_gateway_links l
                  JOIN controllers c ON c.id = l.controller_id AND c.transformer_id IS NOT NULL
                  JOIN gateways g ON g.normalized_gateway_eui = l.gateway_eui
                 ORDER BY c.transformer_id, l.last_heard_at DESC, l.last_rssi DESC""", new MapSqlParameterSource(), (org.springframework.jdbc.core.RowCallbackHandler) rs -> {
            long t = rs.getLong("transformer_id");
            if (out.containsKey(t)) return;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("gatewayId", rs.getLong("gateway_id"));
            m.put("name", rs.getString("name"));
            m.put("status", rs.getString("effective_status"));
            Timestamp at = rs.getTimestamp("last_heard_at");
            m.put("lastHeardAt", at != null ? at.toLocalDateTime().toString() : null);
            m.put("rssi", rs.getObject("last_rssi"));
            m.put("snr", rs.getObject("last_snr"));
            m.put("gatewayCount", rs.getInt("gateway_count"));
            out.put(t, m);
        });
        return out;
    }

    /** All gateways that heard a transformer (for its detail view). */
    public List<Map<String, Object>> gatewaysOf(long transformerId) {
        return jdbc.queryForList("""
                SELECT g.id AS gateway_id, g.name, g.effective_status, g.gateway_eui, MAX(l.last_heard_at) AS last_heard_at,
                       MAX(l.last_rssi) AS last_rssi, MAX(l.last_snr) AS last_snr, SUM(l.uplinks) AS uplinks
                  FROM controller_gateway_links l
                  JOIN controllers c ON c.id = l.controller_id
                  JOIN gateways g ON g.normalized_gateway_eui = l.gateway_eui
                 WHERE c.transformer_id = :t
                 GROUP BY g.id, g.name, g.effective_status, g.gateway_eui
                 ORDER BY last_heard_at DESC""", Map.of("t", transformerId)).stream().map(r -> camel(r)).toList();
    }
}
