package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.config.AccessScopeService;
import com.safalifter.transformerservice.util.TtlCache;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Light read models for the dashboard: headline figures and map points for the visible area.
 * Both are computed from the cached registry rows (one grouped query per scope every 20 s), so
 * panning the map or opening the dashboard does not touch the database per transformer.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MapService {

    /** Above this many transformers in the visible area, return numbered groups instead of dots. */
    public static final int MAX_POINTS = 600;
    private static final int SEARCH_LIMIT = 50;

    private final RegistryService registryService;
    private final AccessScopeService accessScopeService;
    private final NamedParameterJdbcTemplate jdbc;

    private final TtlCache<Map<String, Object>> statsCache = new TtlCache<>(20_000, 512);

    public Map<String, Object> stats() {
        return statsCache.get(accessScopeService.scopeKey(), this::computeStats);
    }

    private Map<String, Object> computeStats() {
        List<RegistryService.RegistryRow> rows = registryService.scopedRows();
        long gmt = 0, pmt = 0, online = 0, delayed = 0, offline = 0, never = 0, noDevice = 0;
        long armed = 0, disarmed = 0, armUnknown = 0, openAlerts = 0, alerting = 0, mapped = 0;
        Set<Long> depots = new HashSet<>();
        for (RegistryService.RegistryRow r : rows) {
            if ("GROUND_MOUNTED".equals(r.getType())) gmt++;
            if ("POLE_MOUNTED".equals(r.getType())) pmt++;
            switch (r.getStatus()) {
                case "ONLINE" -> online++;
                case "DELAYED" -> delayed++;
                case "OFFLINE" -> offline++;
                case "NEVER_SEEN" -> never++;
                default -> noDevice++;
            }
            String arm = armState(r);
            if ("ARMED".equals(arm)) armed++;
            else if ("DISARMED".equals(arm)) disarmed++;
            else if (r.getControllerCount() > 0) armUnknown++;
            openAlerts += r.getOpenAlerts();
            if (r.getOpenAlerts() > 0) alerting++;
            if (r.getLat() != null && r.getLng() != null) mapped++;
            if (r.getDepotId() != null) depots.add(r.getDepotId());
        }
        long withDevice = rows.size() - noDevice;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("scope", accessScopeService.isSupplierScoped() ? "PARTNER" : accessScopeService.isDepotScoped() ? "DEPOT" : "NATIONAL");
        out.put("scopeSupplierName", accessScopeService.getCurrentSupplierName());
        out.put("scopeDepotId", accessScopeService.getCurrentDepotId());
        out.put("transformers", rows.size());
        out.put("groundMounted", gmt);
        out.put("poleMounted", pmt);
        out.put("online", online);
        out.put("delayed", delayed);
        out.put("offline", offline);
        out.put("neverSeen", never);
        out.put("noDevice", noDevice);
        out.put("onlinePercent", withDevice == 0 ? null : Math.round(100.0 * online / withDevice));
        out.put("armed", armed);
        out.put("disarmed", disarmed);
        out.put("armUnknown", armUnknown);
        out.put("openAlerts", openAlerts);
        out.put("transformersAlerting", alerting);
        out.put("mapped", mapped);
        out.put("depotsCovered", depots.size());
        out.put("unmatchedControllers", unmatched());
        return out;
    }

    /**
     * Transformers for the map. With a search term the whole scope is searched (name or device EUI);
     * otherwise only the given area is returned. Large areas are grouped into a grid of clusters.
     */
    public Map<String, Object> map(Double south, Double west, Double north, Double east, Integer zoom, String status, String q) {
        List<RegistryService.RegistryRow> rows = registryService.scopedRows();
        String term = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        String wanted = status == null || status.isBlank() ? null : status.trim().toUpperCase(Locale.ROOT);
        boolean hasBox = !term.isEmpty() ? false : south != null && west != null && north != null && east != null;

        List<RegistryService.RegistryRow> inView = new ArrayList<>();
        Map<String, Integer> counts = new HashMap<>();
        int total = 0, unmapped = 0;
        for (RegistryService.RegistryRow r : rows) {
            if (!term.isEmpty() && !matches(r, term)) continue;
            boolean located = r.getLat() != null && r.getLng() != null;
            boolean visible = located && (!hasBox || inside(r, south, west, north, east));
            if (visible) counts.merge(r.getStatus(), 1, Integer::sum);
            if (wanted != null && !wanted.equals(r.getStatus())) continue;
            total++;
            if (!located) {
                unmapped++;
                continue;
            }
            if (visible) inView.add(r);
        }
        if (!term.isEmpty() && inView.size() > SEARCH_LIMIT) inView = inView.subList(0, SEARCH_LIMIT);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", total);
        out.put("inView", inView.size());
        out.put("unmapped", unmapped);
        out.put("counts", counts);
        if (inView.size() > MAX_POINTS && term.isEmpty()) {
            out.put("mode", "clusters");
            out.put("points", List.of());
            out.put("clusters", cluster(inView, south, west, north, east));
        } else {
            out.put("mode", "points");
            List<Map<String, Object>> points = new ArrayList<>(inView.size());
            for (RegistryService.RegistryRow r : inView) points.add(point(r));
            out.put("points", points);
            out.put("clusters", List.of());
        }
        return out;
    }

    // ------------------------------------------------------------------ helpers

    private static Map<String, Object> point(RegistryService.RegistryRow r) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("id", r.getId());
        p.put("name", r.getName());
        p.put("lat", r.getLat());
        p.put("lng", r.getLng());
        p.put("status", r.getStatus());
        p.put("openAlerts", r.getOpenAlerts());
        p.put("type", r.getType());
        p.put("depotId", r.getDepotId());
        p.put("supplierCode", r.getSupplierCode());
        p.put("supplierName", r.getSupplierName());
        p.put("armState", armState(r));
        return p;
    }

    /** Grid clustering: about 8 x 8 cells across the visible area, each cell centred on its members. */
    private static List<Map<String, Object>> cluster(List<RegistryService.RegistryRow> rows, Double south, Double west, Double north, Double east) {
        double s = south != null ? south : -22.5, n = north != null ? north : -15.5;
        double w = west != null ? west : 25.2, e = east != null ? east : 33.2;
        double cellLat = Math.max((n - s) / 8.0, 1e-4);
        double cellLng = Math.max((e - w) / 8.0, 1e-4);
        Map<String, double[]> cells = new LinkedHashMap<>(); // latSum, lngSum, count, online, offline
        for (RegistryService.RegistryRow r : rows) {
            double lat = r.getLat().doubleValue();
            double lng = r.getLng().doubleValue();
            String key = (int) Math.floor((lat - s) / cellLat) + ":" + (int) Math.floor((lng - w) / cellLng);
            double[] c = cells.computeIfAbsent(key, k -> new double[5]);
            c[0] += lat;
            c[1] += lng;
            c[2]++;
            if ("ONLINE".equals(r.getStatus())) c[3]++;
            if ("OFFLINE".equals(r.getStatus())) c[4]++;
        }
        List<Map<String, Object>> out = new ArrayList<>(cells.size());
        for (double[] c : cells.values()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("lat", c[0] / c[2]);
            m.put("lng", c[1] / c[2]);
            m.put("count", (int) c[2]);
            m.put("online", (int) c[3]);
            m.put("offline", (int) c[4]);
            out.add(m);
        }
        return out;
    }

    private static boolean inside(RegistryService.RegistryRow r, double south, double west, double north, double east) {
        double lat = r.getLat().doubleValue();
        double lng = r.getLng().doubleValue();
        return lat >= south && lat <= north && lng >= west && lng <= east;
    }

    private static boolean matches(RegistryService.RegistryRow r, String term) {
        if (r.getName() != null && r.getName().toLowerCase(Locale.ROOT).contains(term)) return true;
        if (r.getControllerEuis() != null) {
            for (String eui : r.getControllerEuis()) {
                if (eui != null && eui.toLowerCase(Locale.ROOT).contains(term)) return true;
            }
        }
        return false;
    }

    /** ARMED / DISARMED from the last arm or disarm command sent to the site, else UNKNOWN. */
    /**
     * What the controller says its relay is doing (RO1 in its latest uplink) - the same source the partner page uses.
     * Only when a controller has never reported RO1 do we fall back to the last command sent to it.
     */
    static String armState(RegistryService.RegistryRow r) {
        if (r.getReportedArmState() != null) return r.getReportedArmState();
        String a = r.getLastCommandAction();
        if (a == null) return "UNKNOWN";
        String v = a.toUpperCase(Locale.ROOT);
        if (v.startsWith("DISARM")) return "DISARMED";
        if (v.startsWith("ARM")) return "ARMED";
        return "UNKNOWN";
    }

    private long unmatched() {
        if (accessScopeService.isDepotScoped()) return 0;   // unmatched devices have no depot yet
        String supplier = accessScopeService.getCurrentSupplierCode();
        MapSqlParameterSource p = new MapSqlParameterSource();
        if (supplier != null) p.addValue("s", supplier);
        try {
            Long n = jdbc.queryForObject("SELECT COUNT(*) FROM controllers WHERE transformer_id IS NULL"
                    + (supplier != null ? " AND supplier_code = :s" : ""), p, Long.class);
            return n == null ? 0 : n;
        } catch (Exception e) {
            return 0;
        }
    }
}
