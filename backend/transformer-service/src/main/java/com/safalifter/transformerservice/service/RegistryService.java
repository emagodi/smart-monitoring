package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.config.AccessScopeService;
import com.safalifter.transformerservice.entities.Controller;
import com.safalifter.transformerservice.entities.Transformer;
import com.safalifter.transformerservice.entities.TransformerType;
import com.safalifter.transformerservice.payload.response.ExternalTransformerLookupResponse;
import com.safalifter.transformerservice.repository.ControllerRepository;
import com.safalifter.transformerservice.repository.TransformerRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Transformer registry: one row per transformer with its devices, live status and alert
 * counts, built by a single grouped query (no per-row lookups). Also: create a transformer from
 * a partner EUI lookup, and match auto-registered controllers to transformers.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class RegistryService {

    /** Same thresholds as the Oculus control screen. */
    public static final long ONLINE_MINUTES = 15;
    public static final long DELAYED_MINUTES = 30;

    private final NamedParameterJdbcTemplate jdbc;
    private final TransformerRepository transformerRepository;
    private final ControllerRepository controllerRepository;
    private final TransformerService transformerService;
    private final AccessScopeService accessScopeService;
    private final AlertStateService alertStateService;

    @Data
    public static class RegistryRow {
        private Long id;
        private String name;
        private Integer capacity;
        private String type;
        private boolean active;
        private Long depotId;
        private String supplierCode;
        private String supplierName;
        private BigDecimal lat;
        private BigDecimal lng;
        private LocalDateTime lastSignalAt;
        private Long minutesSinceSignal;
        /** ONLINE, DELAYED, OFFLINE, NEVER_SEEN, NO_DEVICE */
        private String status;
        private int controllerCount;
        private List<String> controllerEuis;
        private String lastCommandAction;
        private String lastCommandStatus;
        private LocalDateTime lastCommandAt;
        private int openAlerts;
        private long totalAlerts;
        private LocalDateTime lastAlertAt;
        private String lastAlertMessage;
        private LocalDateTime createdAt;
    }

    @Data
    public static class ImportRequest {
        private String eui;
        private Long depotId;
        /** Optional overrides; the partner lookup fills anything left blank. */
        private String name;
        private String type;
        private Integer capacity;
        private BigDecimal lat;
        private BigDecimal lng;
        private String supplierCode;
        private String supplierName;
    }

    // --------------------------------------------------------------------- registry

    @Transactional(readOnly = true)
    public List<RegistryRow> registry(Long onlyTransformerId) {
        MapSqlParameterSource p = new MapSqlParameterSource();
        List<String> where = new ArrayList<>();
        String supplier = accessScopeService.getCurrentSupplierCode();
        Long depot = accessScopeService.getCurrentDepotId();
        if (supplier != null) {
            where.add("(t.supplier_code = :supplier OR EXISTS (SELECT 1 FROM controllers sc WHERE sc.transformer_id = t.id AND sc.supplier_code = :supplier))");
            p.addValue("supplier", supplier);
        }
        if (depot != null) {
            where.add("t.depot_id = :depot");
            p.addValue("depot", depot);
        }
        if (onlyTransformerId != null) {
            where.add("t.id = :tid");
            p.addValue("tid", onlyTransformerId);
        }
        String sql = """
                SELECT t.id, t.name, t.capacity, t.type, t.is_active, t.depot_id, t.supplier_code, t.supplier_name,
                       t.lat, t.lng, t.last_telemetry_at, t.created_at,
                       COUNT(c.id) AS controller_count,
                       GROUP_CONCAT(c.dev_eui ORDER BY c.id SEPARATOR ',') AS euis,
                       MAX(c.last_reading_at) AS last_reading_at,
                       MAX(c.last_command_at) AS last_command_at,
                       SUBSTRING_INDEX(GROUP_CONCAT(c.last_command_action ORDER BY c.last_command_at DESC SEPARATOR ','), ',', 1) AS last_command_action,
                       SUBSTRING_INDEX(GROUP_CONCAT(c.last_command_status ORDER BY c.last_command_at DESC SEPARATOR ','), ',', 1) AS last_command_status,
                       MAX(s.open_alert_count) AS open_alerts,
                       MAX(s.total_alert_count) AS total_alerts,
                       MAX(s.last_alert_at) AS last_alert_at,
                       MAX(s.last_alert_message) AS last_alert_message
                  FROM transformers t
                  LEFT JOIN controllers c ON c.transformer_id = t.id
                  LEFT JOIN transformer_alert_state s ON s.transformer_id = t.id
                """ + (where.isEmpty() ? "" : " WHERE " + String.join(" AND ", where)) + """
                 GROUP BY t.id
                 ORDER BY t.name
                """;
        LocalDateTime now = LocalDateTime.now();
        return jdbc.query(sql, p, (rs, i) -> mapRow(rs, now));
    }

    private RegistryRow mapRow(ResultSet rs, LocalDateTime now) throws SQLException {
        RegistryRow r = new RegistryRow();
        r.setId(rs.getLong("id"));
        r.setName(rs.getString("name"));
        int cap = rs.getInt("capacity");
        r.setCapacity(rs.wasNull() ? null : cap);
        r.setType(rs.getString("type"));
        r.setActive(rs.getBoolean("is_active"));
        long depot = rs.getLong("depot_id");
        r.setDepotId(rs.wasNull() ? null : depot);
        r.setSupplierCode(rs.getString("supplier_code"));
        r.setSupplierName(rs.getString("supplier_name"));
        r.setLat(rs.getBigDecimal("lat"));
        r.setLng(rs.getBigDecimal("lng"));
        r.setControllerCount(rs.getInt("controller_count"));
        String euis = rs.getString("euis");
        r.setControllerEuis(euis == null || euis.isBlank() ? List.of() : Arrays.stream(euis.split(",")).filter(e -> !e.isBlank()).toList());
        LocalDateTime signal = latest(ts(rs, "last_telemetry_at"), ts(rs, "last_reading_at"));
        r.setLastSignalAt(signal);
        Long minutes = signal == null ? null : Math.max(0, Duration.between(signal, now).toMinutes());
        r.setMinutesSinceSignal(minutes);
        r.setStatus(r.getControllerCount() == 0 ? "NO_DEVICE"
                : minutes == null ? "NEVER_SEEN"
                : minutes <= ONLINE_MINUTES ? "ONLINE"
                : minutes <= DELAYED_MINUTES ? "DELAYED" : "OFFLINE");
        r.setLastCommandAt(ts(rs, "last_command_at"));
        r.setLastCommandAction(rs.getString("last_command_action"));
        r.setLastCommandStatus(rs.getString("last_command_status"));
        r.setOpenAlerts(rs.getInt("open_alerts"));
        r.setTotalAlerts(rs.getLong("total_alerts"));
        r.setLastAlertAt(ts(rs, "last_alert_at"));
        r.setLastAlertMessage(rs.getString("last_alert_message"));
        r.setCreatedAt(ts(rs, "created_at"));
        return r;
    }

    // ------------------------------------------------------------- unmatched queue

    @Transactional(readOnly = true)
    public List<Map<String, Object>> unmatchedControllers() {
        MapSqlParameterSource p = new MapSqlParameterSource();
        String supplier = accessScopeService.getCurrentSupplierCode();
        String sql = """
                SELECT c.id, c.dev_eui, c.device_id, c.name, c.type, c.supplier_code, c.supplier_name,
                       c.last_reading_at, c.last_reading_battery, c.last_reading_rssi, c.last_reading_snr,
                       c.last_reading_di1, c.last_reading_di2, c.created_at
                  FROM controllers c
                 WHERE c.transformer_id IS NULL
                """ + (supplier != null ? " AND c.supplier_code = :supplier" : "") + """
                 ORDER BY COALESCE(c.last_reading_at, c.created_at) DESC
                 LIMIT 1000
                """;
        if (supplier != null) p.addValue("supplier", supplier);
        LocalDateTime now = LocalDateTime.now();
        return jdbc.query(sql, p, (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", rs.getLong("id"));
            m.put("devEui", rs.getString("dev_eui"));
            m.put("deviceId", rs.getString("device_id"));
            m.put("name", rs.getString("name"));
            m.put("type", rs.getString("type"));
            m.put("supplierCode", rs.getString("supplier_code"));
            m.put("supplierName", rs.getString("supplier_name"));
            LocalDateTime last = ts(rs, "last_reading_at");
            m.put("lastReadingAt", last);
            m.put("online", last != null && Duration.between(last, now).toMinutes() <= ONLINE_MINUTES);
            m.put("battery", nullableInt(rs, "last_reading_battery"));
            m.put("rssi", nullableInt(rs, "last_reading_rssi"));
            m.put("snr", nullableInt(rs, "last_reading_snr"));
            m.put("createdAt", ts(rs, "created_at"));
            return m;
        });
    }

    public RegistryRow assign(Long controllerId, Long transformerId) {
        requireWrite();
        Controller controller = controllerRepository.findById(controllerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Controller not found"));
        Transformer transformer = transformerRepository.findById(transformerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer not found"));
        if (controller.getTransformerId() != null && !controller.getTransformerId().equals(transformerId)) {
            String other = transformerRepository.findById(controller.getTransformerId()).map(Transformer::getName).orElse("another transformer");
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Controller " + controller.getDevEui() + " is already linked to " + other + ". Unlink it first.");
        }
        link(controller, transformer);
        return registry(transformerId).stream().findFirst().orElse(null);
    }

    public void unassign(Long controllerId) {
        requireWrite();
        Controller controller = controllerRepository.findById(controllerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Controller not found"));
        Long previous = controller.getTransformerId();
        controller.setTransformerId(null);
        controllerRepository.save(controller);
        if (previous != null) alertStateService.refresh(previous);
    }

    // ------------------------------------------------------------------ EUI import

    @Transactional(readOnly = true)
    public Map<String, Object> previewEui(String rawEui) {
        String eui = normalizeEui(rawEui);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("eui", eui);
        Optional<Controller> controller = controllerRepository.findAllByDevEuiIgnoreCase(eui).stream().findFirst();
        out.put("controllerKnown", controller.isPresent());
        out.put("controllerOnline", controller.map(c -> c.getLastReadingAt() != null
                && Duration.between(c.getLastReadingAt(), LocalDateTime.now()).toMinutes() <= ONLINE_MINUTES).orElse(false));
        out.put("controllerLastReadingAt", controller.map(Controller::getLastReadingAt).orElse(null));
        out.put("linkedTransformerId", controller.map(Controller::getTransformerId).orElse(null));
        out.put("linkedTransformerName", controller.map(Controller::getTransformerId)
                .flatMap(transformerRepository::findById).map(Transformer::getName).orElse(null));
        try {
            ExternalTransformerLookupResponse remote = transformerService.lookupRemoteByEui(eui);
            out.put("remoteFound", true);
            out.put("name", remote.getTransformerName());
            out.put("type", remote.getTransformerType());
            out.put("rawType", remote.getRawTransformerType());
            out.put("lat", remote.getLat());
            out.put("lng", remote.getLng());
        } catch (ResponseStatusException e) {
            out.put("remoteFound", false);
            out.put("remoteMessage", e.getReason());
        }
        return out;
    }

    public RegistryRow importFromEui(ImportRequest r) {
        requireWrite();
        if (r == null || r.getEui() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Device EUI is required");
        if (r.getDepotId() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose the depot (partner lookups do not include depot, district or region)");
        String eui = normalizeEui(r.getEui());

        Optional<Controller> existing = controllerRepository.findAllByDevEuiIgnoreCase(eui).stream().findFirst();
        if (existing.isPresent() && existing.get().getTransformerId() != null) {
            String name = transformerRepository.findById(existing.get().getTransformerId()).map(Transformer::getName).orElse("a transformer");
            throw new ResponseStatusException(HttpStatus.CONFLICT, "EUI " + eui + " is already linked to " + name);
        }

        ExternalTransformerLookupResponse remote = null;
        try {
            remote = transformerService.lookupRemoteByEui(eui);
        } catch (ResponseStatusException e) {
            if (blank(r.getName())) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Partner lookup failed (" + e.getReason() + "). Enter the name and details manually.");
            }
        }
        String name = !blank(r.getName()) ? r.getName().trim() : remote != null ? remote.getTransformerName() : null;
        if (blank(name)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Transformer name is required");
        transformerRepository.findByDepotIdAndName(r.getDepotId(), name).ifPresent(t -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A transformer named " + t.getName() + " already exists in this depot");
        });

        String supplierCode = !blank(r.getSupplierCode()) ? r.getSupplierCode().trim().toLowerCase(Locale.ROOT)
                : existing.map(Controller::getSupplierCode).filter(s -> !blank(s)).orElse("oculus");
        String supplierName = !blank(r.getSupplierName()) ? r.getSupplierName().trim()
                : existing.map(Controller::getSupplierName).filter(s -> !blank(s)).orElse("oculus".equals(supplierCode) ? "Oculus" : supplierCode);

        TransformerType type = parseType(!blank(r.getType()) ? r.getType() : remote != null ? remote.getTransformerType() : null);
        Transformer transformer = transformerRepository.save(Transformer.builder()
                .name(name)
                .capacity(r.getCapacity())
                .isActive(true)
                .depotId(r.getDepotId())
                .supplierCode(supplierCode)
                .supplierName(supplierName)
                .type(type)
                .lat(r.getLat() != null ? r.getLat() : remote != null ? remote.getLat() : null)
                .lng(r.getLng() != null ? r.getLng() : remote != null ? remote.getLng() : null)
                .build());

        Controller controller = existing.orElseGet(() -> controllerRepository.save(Controller.builder()
                .devEui(eui)
                .deviceId(eui)
                .name("Controller " + eui)
                .type("oculus".equals(supplierCode) ? "DRAGINO_LT22222" : null)
                .supplierCode(supplierCode)
                .supplierName(supplierName)
                .build()));
        link(controller, transformer);
        return registry(transformer.getId()).stream().findFirst().orElse(null);
    }

    // ------------------------------------------------------------------ helpers

    private void link(Controller controller, Transformer transformer) {
        controller.setTransformerId(transformer.getId());
        controllerRepository.save(controller);
        boolean changed = false;
        if (blank(transformer.getSupplierCode()) && !blank(controller.getSupplierCode())) {
            transformer.setSupplierCode(controller.getSupplierCode());
            transformer.setSupplierName(controller.getSupplierName());
            changed = true;
        }
        if (controller.getLastReadingAt() != null
                && (transformer.getLastTelemetryAt() == null || controller.getLastReadingAt().isAfter(transformer.getLastTelemetryAt()))) {
            transformer.setLastTelemetryAt(controller.getLastReadingAt());
            changed = true;
        }
        if (changed) transformerRepository.save(transformer);
        alertStateService.refresh(transformer.getId());
    }

    private void requireWrite() {
        if (accessScopeService.isSupplierScoped()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Partner accounts cannot change the transformer registry");
        }
        if (!accessScopeService.hasPermission("transformers.create") && !accessScopeService.hasPermission("transformers.update")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Missing permission: transformers.update");
        }
    }

    private static TransformerType parseType(String raw) {
        if (raw == null) return null;
        String s = raw.trim().toUpperCase(Locale.ROOT).replace(' ', '_');
        if (s.startsWith("GROUND") || s.equals("GMT")) return TransformerType.GROUND_MOUNTED;
        if (s.startsWith("POLE") || s.equals("PMT")) return TransformerType.POLE_MOUNTED;
        try {
            return TransformerType.valueOf(s);
        } catch (Exception e) {
            return null;
        }
    }

    private static String normalizeEui(String eui) {
        if (eui == null || eui.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Device EUI is required");
        String n = eui.replaceAll("[^0-9A-Fa-f]", "").toUpperCase(Locale.ROOT);
        if (n.length() != 16) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A device EUI has 16 hex characters, e.g. A84041F6115E179E");
        return n;
    }

    private static LocalDateTime latest(LocalDateTime a, LocalDateTime b) {
        if (a == null) return b;
        if (b == null) return a;
        return a.isAfter(b) ? a : b;
    }

    private static LocalDateTime ts(ResultSet rs, String col) throws SQLException {
        Timestamp t = rs.getTimestamp(col);
        return t != null ? t.toLocalDateTime() : null;
    }

    private static Integer nullableInt(ResultSet rs, String col) throws SQLException {
        int v = rs.getInt(col);
        return rs.wasNull() ? null : v;
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
