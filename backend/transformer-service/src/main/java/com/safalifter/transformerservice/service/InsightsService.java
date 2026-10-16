package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.config.AccessScopeService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Roll-ups for the dashboards: one block per partner (admin comparison / partner portal) and one
 * per depot. Built from the registry rows plus three grouped queries, so it stays fast as the
 * estate grows. Partner and depot users automatically see only their own slice.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InsightsService {

    private final RegistryService registryService;
    private final NamedParameterJdbcTemplate jdbc;
    private final AccessScopeService accessScopeService;

    public Map<String, Object> overview() {
        List<RegistryService.RegistryRow> rows = registryService.registry(null);
        Map<Long, long[]> incidents = incidentsByTransformer();   // [alerts30d, real, false, technical, arrivalSecSum, arrivalCount]
        Map<String, Long> unmatched = unmatchedBySupplier();
        Map<Long, int[]> fleet = fleetByDepot();                  // [total, available]

        Map<String, Map<String, Object>> partners = new LinkedHashMap<>();
        Map<Long, Map<String, Object>> depots = new LinkedHashMap<>();
        Map<String, Object> totals = block();

        for (RegistryService.RegistryRow r : rows) {
            String code = r.getSupplierCode() != null ? r.getSupplierCode() : "unassigned";
            Map<String, Object> pb = partners.computeIfAbsent(code, k -> {
                Map<String, Object> b = block();
                b.put("supplierCode", k);
                b.put("supplierName", r.getSupplierName() != null ? r.getSupplierName() : "No partner");
                return b;
            });
            Map<String, Object> db = depots.computeIfAbsent(r.getDepotId() == null ? -1L : r.getDepotId(), k -> {
                Map<String, Object> b = block();
                b.put("depotId", r.getDepotId());
                return b;
            });
            long[] inc = incidents.getOrDefault(r.getId(), new long[6]);
            for (Map<String, Object> b : List.of(pb, db, totals)) add(b, r, inc);
        }

        unmatched.forEach((code, n) -> {
            Map<String, Object> pb = partners.get(code);
            if (pb != null) pb.put("unmatchedControllers", n);
        });
        totals.put("unmatchedControllers", unmatched.values().stream().mapToLong(Long::longValue).sum());
        depots.forEach((id, b) -> {
            int[] f = fleet.getOrDefault(id, new int[2]);
            b.put("vehicles", f[0]);
            b.put("vehiclesAvailable", f[1]);
        });

        List<Map<String, Object>> partnerList = new ArrayList<>(partners.values());
        List<Map<String, Object>> depotList = new ArrayList<>(depots.values());
        partnerList.forEach(this::finish);
        depotList.forEach(this::finish);
        finish(totals);
        partnerList.sort(Comparator.comparingLong((Map<String, Object> m) -> (long) m.get("transformers")).reversed());
        depotList.sort(Comparator.comparingLong((Map<String, Object> m) -> (long) m.get("openAlerts")).reversed()
                .thenComparing(Comparator.comparingLong((Map<String, Object> m) -> (long) m.get("transformers")).reversed()));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("scope", accessScopeService.isSupplierScoped() ? "PARTNER" : accessScopeService.isDepotScoped() ? "DEPOT" : "NATIONAL");
        out.put("scopeSupplierCode", accessScopeService.getCurrentSupplierCode());
        out.put("scopeSupplierName", accessScopeService.getCurrentSupplierName());
        out.put("scopeDepotId", accessScopeService.getCurrentDepotId());
        out.put("totals", totals);
        out.put("partners", partnerList);
        out.put("depots", depotList);
        out.put("generatedAt", LocalDateTime.now());
        return out;
    }

    private Map<String, Object> block() {
        Map<String, Object> b = new HashMap<>();
        for (String k : List.of("transformers", "online", "delayed", "offline", "neverSeen", "noDevice", "controllers",
                "openAlerts", "alerts30d", "realThreats30d", "falseAlarms30d", "technicalFaults30d", "arrivalSecSum", "arrivalCount",
                "unmatchedControllers", "groundMounted", "poleMounted", "mapped")) {
            b.put(k, 0L);
        }
        return b;
    }

    private void add(Map<String, Object> b, RegistryService.RegistryRow r, long[] inc) {
        inc(b, "transformers", 1);
        switch (r.getStatus()) {
            case "ONLINE" -> inc(b, "online", 1);
            case "DELAYED" -> inc(b, "delayed", 1);
            case "OFFLINE" -> inc(b, "offline", 1);
            case "NEVER_SEEN" -> inc(b, "neverSeen", 1);
            default -> inc(b, "noDevice", 1);
        }
        if ("GROUND_MOUNTED".equals(r.getType())) inc(b, "groundMounted", 1);
        if ("POLE_MOUNTED".equals(r.getType())) inc(b, "poleMounted", 1);
        if (r.getLat() != null && r.getLng() != null) inc(b, "mapped", 1);
        inc(b, "controllers", r.getControllerCount());
        inc(b, "openAlerts", r.getOpenAlerts());
        inc(b, "alerts30d", inc[0]);
        inc(b, "realThreats30d", inc[1]);
        inc(b, "falseAlarms30d", inc[2]);
        inc(b, "technicalFaults30d", inc[3]);
        inc(b, "arrivalSecSum", inc[4]);
        inc(b, "arrivalCount", inc[5]);
    }

    private void finish(Map<String, Object> b) {
        long devices = (long) b.get("transformers") - (long) b.get("noDevice");
        b.put("onlinePercent", devices == 0 ? null : Math.round(100.0 * (long) b.get("online") / devices));
        long closed = (long) b.get("realThreats30d") + (long) b.get("falseAlarms30d") + (long) b.get("technicalFaults30d");
        b.put("falseAlarmPercent", closed == 0 ? null : Math.round(100.0 * (long) b.get("falseAlarms30d") / closed));
        long n = (long) b.remove("arrivalCount");
        long sum = (long) b.remove("arrivalSecSum");
        b.put("avgArrivalMinutes", n == 0 ? null : Math.round(sum / 6.0 / n) / 10.0);
    }

    private static void inc(Map<String, Object> b, String k, long v) {
        b.put(k, (long) b.get(k) + v);
    }

    private Map<Long, long[]> incidentsByTransformer() {
        MapSqlParameterSource p = new MapSqlParameterSource("since", Timestamp.valueOf(LocalDateTime.now().minusDays(30)));
        Map<Long, long[]> out = new HashMap<>();
        jdbc.query("""
                SELECT a.transformer_id AS tid, COUNT(*) AS n,
                       SUM(CASE WHEN c.outcome = 'REAL_THREAT' THEN 1 ELSE 0 END) AS rt,
                       SUM(CASE WHEN c.outcome = 'FALSE_ALARM' OR c.status = 'FALSE_ALARM' THEN 1 ELSE 0 END) AS fa,
                       SUM(CASE WHEN c.outcome = 'TECHNICAL_FAULT' THEN 1 ELSE 0 END) AS tf,
                       SUM(CASE WHEN c.on_scene_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, a.created_at, c.on_scene_at) ELSE 0 END) AS arr_sum,
                       SUM(CASE WHEN c.on_scene_at IS NOT NULL THEN 1 ELSE 0 END) AS arr_n
                  FROM alerts a
                  LEFT JOIN alert_cases c ON c.alert_id = a.id
                 WHERE a.created_at >= :since AND a.transformer_id IS NOT NULL
                 GROUP BY a.transformer_id
                """, p, rs -> {
            out.put(rs.getLong("tid"), new long[]{rs.getLong("n"), rs.getLong("rt"), rs.getLong("fa"), rs.getLong("tf"),
                    rs.getLong("arr_sum"), rs.getLong("arr_n")});
        });
        return out;
    }

    private Map<String, Long> unmatchedBySupplier() {
        Map<String, Long> out = new HashMap<>();
        String supplier = accessScopeService.getCurrentSupplierCode();
        MapSqlParameterSource p = new MapSqlParameterSource();
        if (supplier != null) p.addValue("s", supplier);
        jdbc.query("SELECT COALESCE(supplier_code, 'unassigned') AS code, COUNT(*) AS n FROM controllers WHERE transformer_id IS NULL"
                        + (supplier != null ? " AND supplier_code = :s" : "") + " GROUP BY COALESCE(supplier_code, 'unassigned')",
                p, rs -> {
                    out.put(rs.getString("code"), rs.getLong("n"));
                });
        return out;
    }

    private Map<Long, int[]> fleetByDepot() {
        Map<Long, int[]> out = new HashMap<>();
        if (accessScopeService.isSupplierScoped()) return out;
        try {
            jdbc.query("SELECT COALESCE(depot_id, -1) AS d, COUNT(*) AS n, SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) AS a"
                            + " FROM response_vehicles WHERE active = 1 GROUP BY COALESCE(depot_id, -1)",
                    new MapSqlParameterSource(), rs -> {
                        out.put(rs.getLong("d"), new int[]{rs.getInt("n"), rs.getInt("a")});
                    });
        } catch (Exception ignored) {
            // fleet table not migrated yet
        }
        return out;
    }
}
