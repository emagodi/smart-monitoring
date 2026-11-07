package com.safalifter.transformerservice.reaction;

import com.safalifter.transformerservice.config.AccessScopeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static com.safalifter.transformerservice.lifecycle.LifecycleService.camel;

/**
 * Alarm analytics for the heat maps and reaction reports: where alerts happen, how they ended (real threat, false
 * alarm, technical fault, authorised work), per partner and per depot, and how fast the team reacted.
 */
@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final NamedParameterJdbcTemplate jdbc;
    private final AccessScopeService scope;

    private static final String OUTCOME_COLS = """
            COUNT(*) AS alerts,
            COALESCE(SUM(c.outcome = 'REAL_THREAT'), 0) AS real_threat,
            COALESCE(SUM(c.outcome = 'FALSE_ALARM' OR (c.outcome IS NULL AND c.status = 'FALSE_ALARM')), 0) AS false_alarm,
            COALESCE(SUM(c.outcome = 'TECHNICAL_FAULT'), 0) AS technical_fault,
            COALESCE(SUM(c.outcome = 'AUTHORISED_ACTIVITY'), 0) AS authorised,
            COALESCE(SUM(c.outcome = 'OTHER'), 0) AS other_outcome,
            COALESCE(SUM(c.id IS NULL OR c.status NOT IN ('RESOLVED', 'FALSE_ALARM')), 0) AS open_cases,
            ROUND(AVG(CASE WHEN c.acknowledged_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, a.created_at, c.acknowledged_at) END) / 60, 1) AS avg_ack_minutes,
            ROUND(AVG(CASE WHEN c.on_scene_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, a.created_at, c.on_scene_at) END) / 60, 1) AS avg_on_scene_minutes,
            COALESCE(SUM(c.acknowledged_at IS NOT NULL AND TIMESTAMPDIFF(SECOND, a.created_at, c.acknowledged_at) <= 300), 0) AS ack_within_5
            """;

    public Map<String, Object> alerts(LocalDate from, LocalDate to, List<Long> depotIds, String supplier, String outcome) {
        if (!scope.hasPermission("alerts.read") && !scope.hasPermission("response.read") && !scope.hasPermission("reports.read") && !scope.isSupplierScoped()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have permission for alarm reports");
        }
        LocalDate f = from != null ? from : LocalDate.now().minusDays(30);
        LocalDate t = to != null ? to : LocalDate.now();
        List<String> where = new ArrayList<>(List.of("a.created_at >= :from", "a.created_at < :to", "a.is_alert = 1"));
        MapSqlParameterSource p = new MapSqlParameterSource().addValue("from", Date.valueOf(f)).addValue("to", Date.valueOf(t.plusDays(1)));
        if (scope.isSupplierScoped()) { where.add("LOWER(a.supplier_code) = LOWER(:scopeSup)"); p.addValue("scopeSup", scope.getCurrentSupplierCode()); }
        if (scope.getCurrentDepotId() != null) { where.add("a.depot_id = :scopeDepot"); p.addValue("scopeDepot", scope.getCurrentDepotId()); }
        if (depotIds != null && !depotIds.isEmpty()) { where.add("a.depot_id IN (:dids)"); p.addValue("dids", depotIds); }
        if (supplier != null && !supplier.isBlank() && !scope.isSupplierScoped()) { where.add("LOWER(a.supplier_code) = LOWER(:sup)"); p.addValue("sup", supplier); }
        if (outcome != null && !outcome.isBlank()) {
            if ("OPEN".equalsIgnoreCase(outcome)) where.add("(c.id IS NULL OR c.status NOT IN ('RESOLVED', 'FALSE_ALARM'))");
            else { where.add("(c.outcome = :oc OR (:oc = 'FALSE_ALARM' AND c.outcome IS NULL AND c.status = 'FALSE_ALARM'))"); p.addValue("oc", outcome.toUpperCase()); }
        }
        String base = " FROM alerts a LEFT JOIN alert_cases c ON c.alert_id = a.id LEFT JOIN transformers t ON t.id = a.transformer_id WHERE " + String.join(" AND ", where);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("from", f.toString());
        out.put("to", t.toString());
        out.put("totals", camel(jdbc.queryForMap("SELECT " + OUTCOME_COLS + base, p)));
        out.put("points", jdbc.queryForList("""
                SELECT a.transformer_id, MAX(COALESCE(t.name, a.transformer_name)) AS transformer_name, MAX(t.transformer_number) AS transformer_number,
                       MAX(COALESCE(t.lat, a.lat)) AS lat, MAX(COALESCE(t.lng, a.lng)) AS lng, MAX(a.depot_id) AS depot_id,
                       MAX(a.supplier_code) AS supplier_code, MAX(a.supplier_name) AS supplier_name, MAX(a.created_at) AS last_alert_at, """
                + OUTCOME_COLS + base + " AND COALESCE(t.lat, a.lat) IS NOT NULL GROUP BY a.transformer_id ORDER BY alerts DESC LIMIT 3000", p)
                .stream().map(r -> camel(r)).toList());
        out.put("byPartner", jdbc.queryForList("SELECT COALESCE(a.supplier_code, '-') AS supplier_code, MAX(a.supplier_name) AS supplier_name, COUNT(DISTINCT a.transformer_id) AS transformers, "
                + OUTCOME_COLS + base + " GROUP BY COALESCE(a.supplier_code, '-') ORDER BY alerts DESC", p).stream().map(r -> camel(r)).toList());
        out.put("byDepot", jdbc.queryForList("SELECT a.depot_id, COUNT(DISTINCT a.transformer_id) AS transformers, "
                + OUTCOME_COLS + base + " GROUP BY a.depot_id ORDER BY alerts DESC", p).stream().map(r -> camel(r)).toList());
        out.put("byDay", jdbc.queryForList("SELECT DATE(a.created_at) AS day, " + OUTCOME_COLS + base + " GROUP BY DATE(a.created_at) ORDER BY day", p)
                .stream().map(r -> camel(r)).toList());
        out.put("topTransformers", jdbc.queryForList("""
                SELECT a.transformer_id, MAX(COALESCE(t.name, a.transformer_name)) AS transformer_name, MAX(t.transformer_number) AS transformer_number,
                       MAX(a.depot_id) AS depot_id, MAX(a.supplier_name) AS supplier_name, """ + OUTCOME_COLS + base
                + " GROUP BY a.transformer_id ORDER BY alerts DESC LIMIT 25", p).stream().map(r -> camel(r)).toList());
        try {
            List<String> fw = new ArrayList<>(List.of("f.reported_at >= :from", "f.reported_at < :to"));
            if (scope.isSupplierScoped()) fw.add("LOWER(f.supplier_code) = LOWER(:scopeSup)");
            if (scope.getCurrentDepotId() != null) fw.add("f.depot_id = :scopeDepot");
            if (depotIds != null && !depotIds.isEmpty()) fw.add("f.depot_id IN (:dids)");
            if (supplier != null && !supplier.isBlank() && !scope.isSupplierScoped()) fw.add("LOWER(f.supplier_code) = LOWER(:sup)");
            out.put("faults", jdbc.queryForList("""
                    SELECT COALESCE(f.supplier_code, '-') AS supplier_code, MAX(f.supplier_name) AS supplier_name, f.fault_type, COUNT(*) AS faults,
                           SUM(f.status = 'OPEN') AS open_faults, ROUND(AVG(CASE WHEN f.resolved_at IS NOT NULL THEN TIMESTAMPDIFF(HOUR, f.reported_at, f.resolved_at) END), 1) AS avg_hours_to_fix
                      FROM transformer_faults f WHERE """ + " " + String.join(" AND ", fw) + " GROUP BY COALESCE(f.supplier_code, '-'), f.fault_type ORDER BY faults DESC", p)
                    .stream().map(r -> camel(r)).toList());
        } catch (Exception e) {
            org.slf4j.LoggerFactory.getLogger(AnalyticsService.class).warn("Fault analytics failed: {}", e.getMessage());
            out.put("faults", List.of());
        }
        return out;
    }
}
