package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.config.AccessScopeService;
import com.safalifter.transformerservice.util.TtlCache;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Read models for the role-based dashboards and the notification bell. Every query is bounded
 * (last 24 hours, 7 or 14 days), grouped in SQL, scoped to the caller's partner / depot and
 * cached briefly, so the dashboards stay cheap however many alerts the table holds.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardService {

    private static final DateTimeFormatter HOUR = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:00");
    private static final DateTimeFormatter DAY = DateTimeFormatter.ISO_LOCAL_DATE;

    private final NamedParameterJdbcTemplate jdbc;
    private final AccessScopeService scope;
    private final RegistryService registryService;

    private final TtlCache<Map<String, Object>> trendsCache = new TtlCache<>(60_000, 512);
    private final TtlCache<List<Map<String, Object>>> feedCache = new TtlCache<>(15_000, 2048);

    // ------------------------------------------------------------------ trends

    public Map<String, Object> trends() {
        return trendsCache.get(scope.scopeKey(), this::computeTrends);
    }

    private Map<String, Object> computeTrends() {
        LocalDateTime now = LocalDateTime.now();
        MapSqlParameterSource p = new MapSqlParameterSource();
        String where = scopeWhere(p);
        p.addValue("s24", Timestamp.valueOf(now.minusHours(24)));
        p.addValue("s7", Timestamp.valueOf(now.minusDays(7)));
        p.addValue("s14", Timestamp.valueOf(LocalDate.now().minusDays(13).atStartOfDay()));

        // New alerts per hour, last 24 h
        Map<String, Long> hourly = new HashMap<>();
        jdbc.query("SELECT DATE_FORMAT(a.created_at, '%Y-%m-%d %H:00') AS h, COUNT(*) AS n FROM alerts a WHERE a.created_at >= :s24" + where + " GROUP BY h",
                p, rs -> {
                    hourly.put(rs.getString("h"), rs.getLong("n"));
                });
        List<Map<String, Object>> hours = new ArrayList<>();
        LocalDateTime start = now.truncatedTo(ChronoUnit.HOURS).minusHours(23);
        for (int i = 0; i < 24; i++) {
            LocalDateTime h = start.plusHours(i);
            hours.add(Map.of("hour", h.format(HOUR), "label", String.format("%02d:00", h.getHour()), "alerts", hourly.getOrDefault(h.format(HOUR), 0L)));
        }

        // Alerts and outcomes per day, last 14 days
        Map<String, long[]> daily = new HashMap<>();
        jdbc.query("""
                SELECT DATE(a.created_at) AS d, COUNT(*) AS n,
                       SUM(CASE WHEN c.outcome = 'REAL_THREAT' THEN 1 ELSE 0 END) AS rt,
                       SUM(CASE WHEN c.outcome = 'FALSE_ALARM' OR c.status = 'FALSE_ALARM' THEN 1 ELSE 0 END) AS fa
                  FROM alerts a LEFT JOIN alert_cases c ON c.alert_id = a.id
                 WHERE a.created_at >= :s14""" + where + " GROUP BY d", p, rs -> {
            daily.put(rs.getDate("d").toLocalDate().format(DAY), new long[]{rs.getLong("n"), rs.getLong("rt"), rs.getLong("fa")});
        });
        List<Map<String, Object>> days = new ArrayList<>();
        LocalDate first = LocalDate.now().minusDays(13);
        for (int i = 0; i < 14; i++) {
            LocalDate d = first.plusDays(i);
            long[] v = daily.getOrDefault(d.format(DAY), new long[3]);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("day", d.format(DAY));
            m.put("label", d.format(DateTimeFormatter.ofPattern("dd MMM", Locale.ENGLISH)));
            m.put("alerts", v[0]);
            m.put("realThreats", v[1]);
            m.put("falseAlarms", v[2]);
            days.add(m);
        }

        // What triggered, last 7 days
        Map<String, Long> types = new LinkedHashMap<>();
        jdbc.query("SELECT COALESCE(a.value, a.sensor_type, a.message) AS t, COUNT(*) AS n FROM alerts a WHERE a.created_at >= :s7" + where + " GROUP BY t",
                p, rs -> {
                    types.merge(triggerLabel(rs.getString("t")), rs.getLong("n"), Long::sum);
                });
        List<Map<String, Object>> byType = new ArrayList<>();
        types.entrySet().stream().sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .forEach(e -> byType.add(Map.of("type", e.getKey(), "alerts", e.getValue())));

        // How incidents ended, last 7 days
        Map<String, Object> outcomes = new LinkedHashMap<>();
        jdbc.query("""
                SELECT SUM(CASE WHEN c.outcome = 'REAL_THREAT' THEN 1 ELSE 0 END) AS rt,
                       SUM(CASE WHEN c.outcome = 'FALSE_ALARM' OR c.status = 'FALSE_ALARM' THEN 1 ELSE 0 END) AS fa,
                       SUM(CASE WHEN c.outcome = 'TECHNICAL_FAULT' THEN 1 ELSE 0 END) AS tf,
                       SUM(CASE WHEN c.status = 'RESOLVED' AND c.outcome IS NULL THEN 1 ELSE 0 END) AS other
                  FROM alert_cases c JOIN alerts a ON a.id = c.alert_id
                 WHERE c.closed_at >= :s7""" + where, p, rs -> {
            outcomes.put("realThreats", rs.getLong("rt"));
            outcomes.put("falseAlarms", rs.getLong("fa"));
            outcomes.put("technicalFaults", rs.getLong("tf"));
            outcomes.put("resolvedOther", rs.getLong("other"));
        });

        // Busiest transformers by open alerts (from the cached registry)
        List<Map<String, Object>> hot = new ArrayList<>();
        registryService.scopedRows().stream()
                .filter(r -> r.getOpenAlerts() > 0)
                .sorted(Comparator.comparingInt(RegistryService.RegistryRow::getOpenAlerts).reversed())
                .limit(8)
                .forEach(r -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", r.getId());
                    m.put("name", r.getName());
                    m.put("depotId", r.getDepotId());
                    m.put("openAlerts", r.getOpenAlerts());
                    m.put("status", r.getStatus());
                    hot.add(m);
                });

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("hourly", hours);
        out.put("daily", days);
        out.put("byType", byType);
        out.put("outcomes7d", outcomes);
        out.put("hotTransformers", hot);
        out.put("generatedAt", now);
        return out;
    }

    static String triggerLabel(String raw) {
        String v = raw == null ? "" : raw.toLowerCase(Locale.ROOT);
        if (v.contains("door")) return "Door opened";
        if (v.contains("motion")) return "Motion";
        if (v.contains("vibration")) return "Vibration";
        if (v.contains("tamper")) return "Tamper";
        if (v.contains("offline") || v.contains("keepalive")) return "Device offline";
        return "Other";
    }

    // ------------------------------------------------------------------ notifications

    /**
     * The bell: what this user should know about, newest first. Contact-centre style users see
     * new and repeating alerts; response users also see dispatch and closure activity; people who
     * manage the registry also hear about devices waiting for a transformer. Partners and depot
     * users only ever see their own scope.
     */
    public List<Map<String, Object>> notifications() {
        String key = scope.scopeKey() + "|" + scope.hasPermission("alerts.read") + scope.hasPermission("response.read")
                + scope.hasPermission("transformers.update") + "|" + scope.getCurrentUserEmail();
        return feedCache.get(key, this::computeNotifications);
    }

    private List<Map<String, Object>> computeNotifications() {
        List<Map<String, Object>> items = new ArrayList<>();
        MapSqlParameterSource p = new MapSqlParameterSource();
        String where = scopeWhere(p);
        p.addValue("since", Timestamp.valueOf(LocalDateTime.now().minusHours(48)));

        boolean alerts = scope.hasPermission("alerts.read") || scope.hasPermission("response.read") || scope.isSupplierScoped();
        if (alerts) {
            jdbc.query("""
                    SELECT a.id, a.value, a.message, a.transformer_id, a.transformer_name, a.depot_name, a.occurrence_count,
                           a.created_at, COALESCE(a.last_seen_at, a.created_at) AS at, COALESCE(c.status, 'NEW') AS st
                      FROM alerts a LEFT JOIN alert_cases c ON c.alert_id = a.id
                     WHERE (a.created_at >= :since OR a.last_seen_at >= :since)""" + where + """
                     ORDER BY at DESC LIMIT 15""", p, rs -> {
                String status = rs.getString("st");
                boolean open = !"RESOLVED".equals(status) && !"FALSE_ALARM".equals(status);
                int times = rs.getInt("occurrence_count");
                String what = firstNonBlank(rs.getString("value"), rs.getString("message"), "Alert");
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", "alert-" + rs.getLong("id") + "-" + times);
                m.put("kind", "ALERT");
                m.put("severity", open ? ("NEW".equals(status) ? "critical" : "warning") : "info");
                m.put("title", what + " · " + firstNonBlank(rs.getString("transformer_name"), "Unknown transformer", null));
                m.put("body", (rs.getString("depot_name") != null ? rs.getString("depot_name") + " depot" : "No depot")
                        + (times > 1 ? " · triggered " + times + " times" : "")
                        + " · " + status.replace('_', ' ').toLowerCase(Locale.ROOT));
                m.put("at", rs.getTimestamp("at").toLocalDateTime());
                m.put("link", scope.hasPermission("response.read") ? "/response" : "/alerts?q=" + urlEncode(rs.getString("transformer_name")));
                items.add(m);
            });
        }

        if (scope.hasPermission("response.read")) {
            try {
                jdbc.query("""
                        SELECT ac.id, ac.activity_type, ac.status_after, ac.actor_name, ac.note, ac.created_at,
                               a.transformer_name, a.depot_name
                          FROM alert_case_activities ac
                          JOIN alert_cases c ON c.id = ac.alert_case_id
                          JOIN alerts a ON a.id = c.alert_id
                         WHERE ac.created_at >= :since
                           AND ac.activity_type IN ('VEHICLE_DISPATCHED', 'CREW_UPDATE', 'STATUS_CHANGED', 'ASSIGNMENT_CHANGED')""" + where + """
                         ORDER BY ac.created_at DESC LIMIT 10""", p, rs -> {
                    String type = rs.getString("activity_type");
                    String after = rs.getString("status_after");
                    String actor = firstNonBlank(rs.getString("actor_name"), "Someone", null);
                    String t = rs.getString("transformer_name");
                    String title = switch (type) {
                        case "VEHICLE_DISPATCHED" -> "Vehicle dispatched to " + t;
                        case "CREW_UPDATE" -> "Crew update · " + t;
                        case "ASSIGNMENT_CHANGED" -> actor + " took " + t;
                        default -> t + " → " + (after == null ? "updated" : after.replace('_', ' ').toLowerCase(Locale.ROOT));
                    };
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", "act-" + rs.getLong("id"));
                    m.put("kind", "RESPONSE");
                    m.put("severity", "RESOLVED".equals(after) || "FALSE_ALARM".equals(after) ? "success" : "info");
                    m.put("title", title);
                    m.put("body", firstNonBlank(rs.getString("note"), "By " + actor, null) + (rs.getString("depot_name") != null ? " · " + rs.getString("depot_name") : ""));
                    m.put("at", rs.getTimestamp("created_at").toLocalDateTime());
                    m.put("link", "/response");
                    items.add(m);
                });
            } catch (Exception ignored) {
                // activity table not migrated yet
            }
        }

        if (scope.hasPermission("transformers.update") && !scope.isSupplierScoped()) {
            try {
                Map<String, Object> row = jdbc.queryForMap("""
                        SELECT COUNT(*) AS n, MAX(COALESCE(last_reading_at, created_at)) AS at
                          FROM controllers WHERE transformer_id IS NULL""", new MapSqlParameterSource());
                long n = ((Number) row.get("n")).longValue();
                if (n > 0 && row.get("at") != null) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", "unmatched-" + n);
                    m.put("kind", "SYSTEM");
                    m.put("severity", "warning");
                    m.put("title", n + " device" + (n == 1 ? " is" : "s are") + " waiting for a transformer");
                    m.put("body", "Link them so their alerts reach the right depot.");
                    Object at = row.get("at");
                    m.put("at", at instanceof Timestamp ts ? ts.toLocalDateTime() : at instanceof LocalDateTime l ? l : LocalDateTime.now());
                    m.put("link", "/new-controllers");
                    items.add(m);
                }
            } catch (Exception ignored) {
                // controllers table not available
            }
        }

        items.sort(Comparator.comparing((Map<String, Object> m) -> (LocalDateTime) m.get("at")).reversed());
        return items.size() > 25 ? new ArrayList<>(items.subList(0, 25)) : items;
    }

    // ------------------------------------------------------------------ helpers

    private String scopeWhere(MapSqlParameterSource p) {
        StringBuilder w = new StringBuilder();
        String supplier = scope.getCurrentSupplierCode();
        Long depot = scope.getCurrentDepotId();
        if (supplier != null) {
            w.append(" AND a.supplier_code = :scopeSupplier");
            p.addValue("scopeSupplier", supplier);
        }
        if (depot != null) {
            w.append(" AND a.depot_id = :scopeDepot");
            p.addValue("scopeDepot", depot);
        }
        return w.toString();
    }

    private static String firstNonBlank(String a, String b, String c) {
        if (a != null && !a.isBlank()) return a;
        if (b != null && !b.isBlank()) return b;
        return c;
    }

    private static String urlEncode(String s) {
        return s == null ? "" : java.net.URLEncoder.encode(s, java.nio.charset.StandardCharsets.UTF_8);
    }
}
