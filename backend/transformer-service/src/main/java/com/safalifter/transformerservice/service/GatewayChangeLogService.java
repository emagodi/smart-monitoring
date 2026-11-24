package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.entities.Gateway;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;

/**
 * Audit trail for gateways: every change to a gateway's identity, location or assignment, whether it came from the
 * LORIOT sync (renamed, re-registered with a new LORIOT id, new EUI / MAC, moved) or from a user (edit, merge, delete).
 * Rows survive the gateway's deletion (gateway_id is not a foreign key), so a deleted gateway's history stays readable.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GatewayChangeLogService {

    public static final String SRC_LORIOT = "LORIOT_SYNC";
    public static final String SRC_USER = "USER";

    private final NamedParameterJdbcTemplate jdbc;

    /** The fields we track, with the label shown in the history. */
    private static final Map<String, Function<Gateway, Object>> FIELDS = new LinkedHashMap<>();

    static {
        FIELDS.put("name", Gateway::getName);
        FIELDS.put("loriotGatewayId", Gateway::getLoriotGatewayId);
        FIELDS.put("gatewayEui", Gateway::getGatewayEui);
        FIELDS.put("macAddress", Gateway::getMacAddress);
        FIELDS.put("serialNumber", Gateway::getSerialNumber);
        FIELDS.put("imei", Gateway::getImei);
        FIELDS.put("manufacturer", Gateway::getManufacturer);
        FIELDS.put("model", Gateway::getModel);
        FIELDS.put("firmwareVersion", Gateway::getFirmwareVersion);
        FIELDS.put("networkId", Gateway::getNetworkId);
        FIELDS.put("networkName", Gateway::getNetworkName);
        FIELDS.put("operator", Gateway::getOperator);
        FIELDS.put("customer", Gateway::getCustomer);
        FIELDS.put("description", Gateway::getDescription);
        FIELDS.put("latitude", Gateway::getLatitude);
        FIELDS.put("longitude", Gateway::getLongitude);
        FIELDS.put("address", Gateway::getAddress);
        FIELDS.put("locationSource", Gateway::getLocationSource);
        FIELDS.put("regionName", Gateway::getRegionName);
        FIELDS.put("districtName", Gateway::getDistrictName);
        FIELDS.put("depotName", Gateway::getDepotName);
        FIELDS.put("depotId", Gateway::getDepotId);
        FIELDS.put("commissioningDate", Gateway::getCommissioningDate);
        FIELDS.put("decommissioned", Gateway::getDecommissioned);
    }

    public Map<String, String> snapshot(Gateway g) {
        Map<String, String> m = new LinkedHashMap<>();
        if (g == null) return m;
        FIELDS.forEach((k, f) -> m.put(k, str(f.apply(g))));
        return m;
    }

    /** Records one row per field that differs between the snapshot taken before a change and the gateway now. */
    public int recordDiff(Gateway g, Map<String, String> before, String source, String actor, String note) {
        if (g == null || before == null) return 0;
        Map<String, String> after = snapshot(g);
        int n = 0;
        for (Map.Entry<String, String> e : after.entrySet()) {
            String old = before.get(e.getKey());
            if (!same(e.getKey(), old, e.getValue())) {
                insert(g.getId(), g.getName(), g.getGatewayEui(), "UPDATE", e.getKey(), old, e.getValue(), source, actor, note);
                n++;
            }
        }
        return n;
    }

    public void record(Gateway g, String action, String source, String actor, String note) {
        if (g == null) return;
        insert(g.getId(), g.getName(), g.getGatewayEui(), action, null, null, null, source, actor, note);
    }

    public void recordField(Gateway g, String action, String field, String oldValue, String newValue, String source, String actor, String note) {
        if (g == null) return;
        insert(g.getId(), g.getName(), g.getGatewayEui(), action, field, oldValue, newValue, source, actor, note);
    }

    /** The most recent action recorded for a gateway (so "removed in LORIOT" is logged once, not on every sync). */
    public String lastAction(Long gatewayId) {
        if (gatewayId == null) return null;
        try {
            List<String> r = jdbc.queryForList("SELECT action FROM gateway_change_log WHERE gateway_id = :g ORDER BY id DESC LIMIT 1",
                    Map.of("g", gatewayId), String.class);
            return r.isEmpty() ? null : r.get(0);
        } catch (Exception e) {
            return null;
        }
    }

    public Map<String, Object> history(long gatewayId, int page, int size) {
        int sz = Math.max(1, Math.min(size, 200));
        MapSqlParameterSource p = new MapSqlParameterSource("g", gatewayId).addValue("lim", sz).addValue("off", (long) Math.max(0, page) * sz);
        List<Map<String, Object>> rows;
        Long total;
        try {
            total = jdbc.queryForObject("SELECT COUNT(*) FROM gateway_change_log WHERE gateway_id = :g", p, Long.class);
            rows = jdbc.queryForList("""
                    SELECT id, gateway_id, gateway_name, gateway_eui, action, field, old_value, new_value, source, actor, note, changed_at
                      FROM gateway_change_log WHERE gateway_id = :g ORDER BY changed_at DESC, id DESC LIMIT :lim OFFSET :off""", p);
        } catch (Exception e) {
            log.warn("Gateway change log unavailable: {}", e.getMessage());
            total = 0L;
            rows = List.of();
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.get("id"));
            m.put("gatewayId", r.get("gateway_id"));
            m.put("gatewayName", r.get("gateway_name"));
            m.put("gatewayEui", r.get("gateway_eui"));
            m.put("action", r.get("action"));
            m.put("field", r.get("field"));
            m.put("oldValue", r.get("old_value"));
            m.put("newValue", r.get("new_value"));
            m.put("source", r.get("source"));
            m.put("actor", r.get("actor"));
            m.put("note", r.get("note"));
            Object at = r.get("changed_at");
            m.put("changedAt", at instanceof Timestamp ts ? ts.toLocalDateTime().toString() : at != null ? at.toString() : null);
            out.add(m);
        }
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("content", out);
        res.put("totalElements", total == null ? 0 : total);
        return res;
    }

    private void insert(Long gatewayId, String name, String eui, String action, String field, String oldV, String newV,
                        String source, String actor, String note) {
        try {
            jdbc.update("""
                    INSERT INTO gateway_change_log (gateway_id, gateway_name, gateway_eui, action, field, old_value, new_value, source, actor, note, changed_at)
                    VALUES (:g, :n, :e, :a, :f, :o, :v, :s, :actor, :note, :at)""",
                    new MapSqlParameterSource().addValue("g", gatewayId).addValue("n", cut(name, 255)).addValue("e", cut(eui, 64))
                            .addValue("a", action).addValue("f", field).addValue("o", cut(oldV, 1000)).addValue("v", cut(newV, 1000))
                            .addValue("s", source).addValue("actor", cut(actor, 255)).addValue("note", cut(note, 2000))
                            .addValue("at", Timestamp.valueOf(LocalDateTime.now())));
        } catch (Exception e) {
            // The audit trail must never break a sync or an edit.
            log.warn("Could not write gateway change log for gateway {}: {}", gatewayId, e.getMessage());
        }
    }

    private static boolean same(String field, String a, String b) {
        if (Objects.equals(a, b)) return true;
        if (a == null || b == null) return false;
        if ("latitude".equals(field) || "longitude".equals(field)) {
            try {
                return new BigDecimal(a).compareTo(new BigDecimal(b)) == 0;
            } catch (NumberFormatException ignored) {
                return false;
            }
        }
        if ("gatewayEui".equals(field) || "macAddress".equals(field)) {
            return a.replaceAll("[^A-Fa-f0-9]", "").equalsIgnoreCase(b.replaceAll("[^A-Fa-f0-9]", ""));
        }
        return false;
    }

    private static String str(Object o) {
        if (o == null) return null;
        if (o instanceof BigDecimal bd) return bd.stripTrailingZeros().toPlainString();
        String s = o.toString().trim();
        return s.isEmpty() ? null : s;
    }

    private static String cut(String s, int n) {
        return s == null ? null : s.length() > n ? s.substring(0, n) : s;
    }
}
