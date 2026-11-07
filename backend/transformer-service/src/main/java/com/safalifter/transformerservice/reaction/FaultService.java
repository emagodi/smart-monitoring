package com.safalifter.transformerservice.reaction;

import com.safalifter.transformerservice.config.AccessScopeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Fault alarms: equipment problems on a transformer's monitoring kit (not intrusions) that the partner must fix,
 * e.g. a faulty sensor that keeps triggering, power or battery problems, communication loss. Raised from the
 * transformer list or automatically when an incident is closed as "technical fault"; resolved when fixed.
 */
@Service
@RequiredArgsConstructor
public class FaultService {

    public static final Set<String> TYPES = Set.of("FALSE_TRIGGERING", "SENSOR_FAULT", "POWER_SUPPLY", "BATTERY", "COMMUNICATION",
            "SIREN_LIGHTS", "TAMPERED", "DEVICE_OFFLINE", "OTHER");

    private final NamedParameterJdbcTemplate jdbc;
    private final AccessScopeService scope;

    public record Raise(Long transformerId, String faultType, String description, Long alertId, Boolean suppressAlerts, Boolean closeOpenAlerts) {}

    public record Suppress(Boolean suppress) {}

    @org.springframework.beans.factory.annotation.Autowired
    @org.springframework.context.annotation.Lazy
    private com.safalifter.transformerservice.service.ResponseService responseService;

    public record Resolve(String note) {}

    public Map<String, Object> raise(Raise in) {
        require("faults.record");
        if (in == null || in.transformerId() == null) bad("Choose the transformer");
        String type = in.faultType() == null ? "OTHER" : in.faultType().trim().toUpperCase(Locale.ROOT);
        if (!TYPES.contains(type)) bad("Unknown fault type");
        Map<String, Object> f = insert(in.transformerId(), type, in.description(), in.alertId(), scope.getCurrentUserEmail(), true);
        long id = ((Number) f.get("id")).longValue();
        boolean suppress = !Boolean.FALSE.equals(in.suppressAlerts());
        jdbc.update("UPDATE transformer_faults SET suppress_alerts = :s WHERE id = :id", new MapSqlParameterSource("s", suppress).addValue("id", id));
        if (!Boolean.FALSE.equals(in.closeOpenAlerts())) {
            int closed = closeOpenAlerts(in.transformerId(), id, FAULT_LABEL.getOrDefault(type, type));
            jdbc.update("UPDATE transformer_faults SET alerts_closed = :n WHERE id = :id", new MapSqlParameterSource("n", closed).addValue("id", id));
        }
        return get(id);
    }

    private static final Map<String, String> FAULT_LABEL = Map.of("FALSE_TRIGGERING", "keeps triggering falsely", "SENSOR_FAULT", "sensor fault",
            "POWER_SUPPLY", "power supply", "BATTERY", "battery", "COMMUNICATION", "communication", "SIREN_LIGHTS", "siren / lights",
            "TAMPERED", "tampered", "DEVICE_OFFLINE", "device offline", "OTHER", "fault");

    /** Closes the transformer's open incidents as "technical fault" (the device, not an intruder, caused them). */
    private int closeOpenAlerts(Long transformerId, long faultId, String what) {
        List<Long> open = jdbc.queryForList("""
                SELECT a.id FROM alerts a LEFT JOIN alert_cases c ON c.alert_id = a.id
                 WHERE a.transformer_id = :t AND (c.id IS NULL OR c.status NOT IN ('RESOLVED', 'FALSE_ALARM')) ORDER BY a.id LIMIT 5000""",
                Map.of("t", transformerId), Long.class);
        int n = 0;
        for (Long alertId : open) {
            try {
                if (responseService.closeAsSystem(alertId, com.safalifter.transformerservice.enums.IncidentOutcome.TECHNICAL_FAULT,
                        "Closed with fault alarm #" + faultId + " (" + what + ") raised by " + scope.getCurrentUserEmail())) n++;
            } catch (Exception e) {
                // keep going: one bad case must not stop the rest
            }
        }
        return n;
    }

    /** Pause / resume alerts for an open fault. */
    public Map<String, Object> setSuppression(long id, Suppress in) {
        require("faults.record");
        Map<String, Object> f = get(id);
        if (!"OPEN".equals(f.get("status"))) bad("The fault is already resolved");
        jdbc.update("UPDATE transformer_faults SET suppress_alerts = :s WHERE id = :id",
                new MapSqlParameterSource("s", in == null || !Boolean.FALSE.equals(in.suppress())).addValue("id", id));
        return get(id);
    }

    /**
     * Open fault on this transformer that pauses its alerts (no incident, no paging, no siren) until resolved, or null.
     * Used by the alert pipeline; no permission check.
     */
    public Long suppressingFault(Long transformerId) {
        if (transformerId == null) return null;
        try {
            List<Long> ids = jdbc.queryForList("SELECT id FROM transformer_faults WHERE transformer_id = :t AND status = 'OPEN' AND suppress_alerts = 1 ORDER BY id DESC LIMIT 1",
                    Map.of("t", transformerId), Long.class);
            return ids.isEmpty() ? null : ids.get(0);
        } catch (Exception e) {
            return null;
        }
    }

    public void recordSuppressedTrigger(Long faultId) {
        if (faultId == null) return;
        try {
            jdbc.update("UPDATE transformer_faults SET suppressed_triggers = suppressed_triggers + 1, last_suppressed_at = :now WHERE id = :id",
                    new MapSqlParameterSource("now", Timestamp.valueOf(LocalDateTime.now())).addValue("id", faultId));
        } catch (Exception ignored) {
            // counting is best effort
        }
    }

    /** Called when an incident is closed as a technical fault (no permission check: the close itself was checked). */
    public void fromIncident(Long transformerId, Long alertId, String note, String actor) {
        if (transformerId == null) return;
        try {
            Long open = jdbc.query("SELECT id FROM transformer_faults WHERE transformer_id = :t AND status = 'OPEN' AND alert_id = :a LIMIT 1",
                    new MapSqlParameterSource("t", transformerId).addValue("a", alertId), rs -> rs.next() ? rs.getLong(1) : null);
            if (open == null) {
                try {
                    insert(transformerId, "SENSOR_FAULT", note != null ? note : "Incident #" + alertId + " closed as technical fault", alertId, actor, false);
                } catch (Exception ignored) {
                    // inserted; reading it back needs faults.read, which the closing user may not have
                }
                // raised from one incident: alerts keep flowing until someone pauses them on the Fault alarms page
                jdbc.update("UPDATE transformer_faults SET suppress_alerts = 0 WHERE transformer_id = :t AND alert_id = :a",
                        new MapSqlParameterSource("t", transformerId).addValue("a", alertId));
            }
        } catch (Exception ignored) {
            // table not ready yet: the incident close must still succeed
        }
    }

    private Map<String, Object> insert(Long transformerId, String type, String description, Long alertId, String by, boolean scoped) {
        List<Map<String, Object>> t = jdbc.queryForList("SELECT id, name, depot_id, supplier_code, supplier_name FROM transformers WHERE id = :id", Map.of("id", transformerId));
        if (t.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer not found");
        Map<String, Object> tr = t.get(0);
        if (scoped && scope.getCurrentDepotId() != null && tr.get("depot_id") != null && !scope.getCurrentDepotId().equals(((Number) tr.get("depot_id")).longValue())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "That transformer is not in your depot");
        }
        String supplier = (String) tr.get("supplier_code");
        String supplierName = (String) tr.get("supplier_name");
        if (supplier == null) {
            List<Map<String, Object>> c = jdbc.queryForList("SELECT supplier_code, supplier_name FROM controllers WHERE transformer_id = :id AND supplier_code IS NOT NULL LIMIT 1", Map.of("id", transformerId));
            if (!c.isEmpty()) { supplier = (String) c.get(0).get("supplier_code"); supplierName = (String) c.get(0).get("supplier_name"); }
        }
        if (scoped && scope.isSupplierScoped() && (supplier == null || !supplier.equalsIgnoreCase(scope.getCurrentSupplierCode()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "That transformer is not one of yours");
        }
        KeyHolder kh = new GeneratedKeyHolder();
        jdbc.update("""
                INSERT INTO transformer_faults (transformer_id, depot_id, supplier_code, supplier_name, alert_id, fault_type, description, status, reported_by, reported_at)
                VALUES (:t, :d, :sc, :sn, :a, :type, :desc, 'OPEN', :by, :now)""",
                new MapSqlParameterSource().addValue("t", transformerId).addValue("d", tr.get("depot_id")).addValue("sc", supplier).addValue("sn", supplierName)
                        .addValue("a", alertId).addValue("type", type).addValue("desc", cut(description, 2000)).addValue("by", by == null ? "system" : by)
                        .addValue("now", Timestamp.valueOf(LocalDateTime.now())), kh, new String[]{"id"});
        return get(kh.getKey().longValue());
    }

    public Map<String, Object> resolve(long id, Resolve in) {
        require("faults.record");
        Map<String, Object> f = get(id);
        if (!"OPEN".equals(f.get("status"))) bad("Already resolved");
        jdbc.update("UPDATE transformer_faults SET status = 'RESOLVED', resolved_by = :by, resolved_at = :now, resolution_note = :n WHERE id = :id",
                new MapSqlParameterSource().addValue("by", scope.getCurrentUserEmail()).addValue("now", Timestamp.valueOf(LocalDateTime.now()))
                        .addValue("n", in != null ? cut(in.note(), 2000) : null).addValue("id", id));
        return get(id);
    }

    public Map<String, Object> get(long id) {
        require("faults.read", "faults.record");
        List<String> where = new ArrayList<>(List.of("f.id = :id"));
        MapSqlParameterSource p = new MapSqlParameterSource("id", id);
        scope(where, p);
        List<Map<String, Object>> rows = jdbc.queryForList(SELECT + " WHERE " + String.join(" AND ", where), p);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Fault not found");
        return com.safalifter.transformerservice.lifecycle.LifecycleService.camel(rows.get(0));
    }

    private static final String SELECT = """
            SELECT f.*, t.name AS transformer_name, t.transformer_number,
                   TIMESTAMPDIFF(HOUR, f.reported_at, COALESCE(f.resolved_at, NOW())) AS age_hours
              FROM transformer_faults f JOIN transformers t ON t.id = f.transformer_id""";

    public Map<String, Object> list(String status, Long transformerId, String supplier, List<Long> depotIds, String type, LocalDate from, LocalDate to, String q, int page, int size) {
        require("faults.read", "faults.record");
        List<String> where = new ArrayList<>();
        MapSqlParameterSource p = new MapSqlParameterSource();
        scope(where, p);
        if (transformerId != null) { where.add("f.transformer_id = :tid"); p.addValue("tid", transformerId); }
        if (supplier != null && !supplier.isBlank() && !scope.isSupplierScoped()) { where.add("LOWER(f.supplier_code) = LOWER(:sup)"); p.addValue("sup", supplier); }
        if (depotIds != null && !depotIds.isEmpty()) { where.add("f.depot_id IN (:dids)"); p.addValue("dids", depotIds); }
        if (type != null && !type.isBlank()) { where.add("f.fault_type = :type"); p.addValue("type", type.toUpperCase(Locale.ROOT)); }
        if (from != null) { where.add("f.reported_at >= :from"); p.addValue("from", Date.valueOf(from)); }
        if (to != null) { where.add("f.reported_at < :to"); p.addValue("to", Date.valueOf(to.plusDays(1))); }
        if (q != null && !q.isBlank()) { where.add("(t.name LIKE :q OR t.transformer_number LIKE :q OR f.description LIKE :q)"); p.addValue("q", "%" + q.trim() + "%"); }
        List<String> withStatus = new ArrayList<>(where);
        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) { withStatus.add("f.status = :st"); p.addValue("st", status.toUpperCase(Locale.ROOT)); }
        String w = withStatus.isEmpty() ? "" : " WHERE " + String.join(" AND ", withStatus);
        Long total = jdbc.queryForObject("SELECT COUNT(*) FROM transformer_faults f JOIN transformers t ON t.id = f.transformer_id" + w, p, Long.class);
        int lim = Math.max(1, Math.min(5000, size));
        p.addValue("lim", lim).addValue("off", Math.max(0, page) * (long) lim);
        List<Map<String, Object>> rows = jdbc.queryForList(SELECT + w + " ORDER BY f.status = 'OPEN' DESC, f.reported_at DESC LIMIT :lim OFFSET :off", p);
        Map<String, Long> counts = new LinkedHashMap<>();
        jdbc.query("SELECT f.status, COUNT(*) FROM transformer_faults f JOIN transformers t ON t.id = f.transformer_id"
                        + (where.isEmpty() ? "" : " WHERE " + String.join(" AND ", where)) + " GROUP BY f.status", p,
                (org.springframework.jdbc.core.RowCallbackHandler) rs -> counts.put(rs.getString(1), rs.getLong(2)));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("content", rows.stream().map(com.safalifter.transformerservice.lifecycle.LifecycleService::camel).toList());
        out.put("totalElements", total == null ? 0 : total);
        out.put("counts", counts);
        return out;
    }

    /** Open fault count per transformer, for the transformer list. */
    public Map<Long, Long> openByTransformer() {
        require("faults.read", "faults.record", "transformers.read");
        List<String> where = new ArrayList<>(List.of("f.status = 'OPEN'"));
        MapSqlParameterSource p = new MapSqlParameterSource();
        scope(where, p);
        Map<Long, Long> m = new LinkedHashMap<>();
        jdbc.query("SELECT f.transformer_id, COUNT(*) FROM transformer_faults f WHERE " + String.join(" AND ", where) + " GROUP BY f.transformer_id", p,
                (org.springframework.jdbc.core.RowCallbackHandler) rs -> m.put(rs.getLong(1), rs.getLong(2)));
        return m;
    }

    private void scope(List<String> where, MapSqlParameterSource p) {
        if (scope.isSupplierScoped()) { where.add("LOWER(f.supplier_code) = LOWER(:scopeSup)"); p.addValue("scopeSup", scope.getCurrentSupplierCode()); }
        if (scope.getCurrentDepotId() != null) { where.add("f.depot_id = :scopeDepot"); p.addValue("scopeDepot", scope.getCurrentDepotId()); }
    }

    private void require(String... anyOf) {
        for (String perm : anyOf) if (scope.hasPermission(perm)) return;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have permission for fault alarms");
    }

    private static void bad(String m) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, m);
    }

    private static String cut(String s, int max) {
        if (s == null || s.isBlank()) return null;
        String t = s.trim();
        return t.length() > max ? t.substring(0, max) : t;
    }
}
