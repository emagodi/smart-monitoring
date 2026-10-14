package com.safalifter.transformerservice.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safalifter.transformerservice.payload.response.TransformerAlertStateResponse;
import com.safalifter.transformerservice.repository.AlertQueryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import jakarta.persistence.EntityManager;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Maintains transformer_alert_state: one row per transformer holding open-alert count,
 * totals, the latest alert and a JSON snapshot of the 3 most recent alerts.
 *
 * Dashboard / map / region screens read this table (about one row per transformer)
 * instead of scanning or paging through the alerts table. The row is recomputed on every
 * alert write (create, fold, case update, delete) using index-bounded queries.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AlertStateService {

    public static final int RECENT_ALERTS_KEPT = 3;

    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final EntityManager entityManager;

    /**
     * Serialises concurrent alert writes for one transformer (two uplinks arriving together
     * must not both create a "new" alert). Must be called inside a transaction; the row lock
     * is held until that transaction commits.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void lockTransformer(Long transformerId) {
        if (transformerId == null) {
            return;
        }
        MapSqlParameterSource params = new MapSqlParameterSource("id", transformerId);
        jdbc.update("INSERT IGNORE INTO transformer_alert_state (transformer_id, updated_at) VALUES (:id, NOW(6))", params);
        jdbc.queryForList("SELECT transformer_id FROM transformer_alert_state WHERE transformer_id = :id FOR UPDATE", params, Long.class);
    }

    /** Recompute the snapshot row for one transformer. Cheap: every query is bounded by idx_alerts_transformer_id. */
    @Transactional
    public void refresh(Long transformerId) {
        if (transformerId == null) {
            return;
        }
        // Hibernate defers UPDATEs until flush; push pending alert/case changes to the
        // connection so the JDBC reads below see them (same transaction, same connection).
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            entityManager.flush();
        }
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("id", transformerId)
                .addValue("openStatuses", AlertQueryRepository.OPEN_STATUSES)
                .addValue("recent", RECENT_ALERTS_KEPT);

        List<TransformerAlertStateResponse.RecentAlert> recent = jdbc.query("""
                SELECT a.id, a.message, a.value, a.sensor_type, a.device_name, a.occurrence_count,
                       a.created_at, a.last_seen_at, c.status AS case_status
                  FROM alerts a
                  LEFT JOIN alert_cases c ON c.alert_id = a.id
                 WHERE a.transformer_id = :id
                 ORDER BY a.id DESC
                 LIMIT :recent
                """, params, (rs, i) -> TransformerAlertStateResponse.RecentAlert.builder()
                .id(rs.getLong("id"))
                .message(rs.getString("message"))
                .value(rs.getString("value"))
                .sensorType(rs.getString("sensor_type"))
                .deviceName(rs.getString("device_name"))
                .occurrenceCount(rs.getInt("occurrence_count"))
                .caseStatus(rs.getString("case_status"))
                .createdAt(toLdt(rs.getTimestamp("created_at")))
                .lastSeenAt(toLdt(rs.getTimestamp("last_seen_at")))
                .build());

        Map<String, Object> totals = jdbc.queryForMap("""
                SELECT COUNT(*) AS alerts,
                       COALESCE(SUM(a.occurrence_count), 0) AS events,
                       COALESCE(SUM(CASE WHEN c.status IN (:openStatuses) THEN 1 ELSE 0 END), 0) AS open_alerts
                  FROM alerts a
                  LEFT JOIN alert_cases c ON c.alert_id = a.id
                 WHERE a.transformer_id = :id
                """, params);

        TransformerAlertStateResponse.RecentAlert latest = recent.isEmpty() ? null : recent.get(0);
        LocalDateTime latestAt = latest == null ? null
                : (latest.getLastSeenAt() != null ? latest.getLastSeenAt() : latest.getCreatedAt());

        MapSqlParameterSource upsert = new MapSqlParameterSource()
                .addValue("id", transformerId)
                .addValue("openCount", toLong(totals.get("open_alerts")))
                .addValue("totalAlerts", toLong(totals.get("alerts")))
                .addValue("totalEvents", toLong(totals.get("events")))
                .addValue("lastAlertId", latest != null ? latest.getId() : null)
                .addValue("lastAlertAt", latestAt != null ? Timestamp.valueOf(latestAt) : null)
                .addValue("lastMessage", latest != null ? truncate(latest.getMessage(), 1000) : null)
                .addValue("lastStatus", latest != null ? latest.getCaseStatus() : null)
                .addValue("recentJson", writeJson(recent));

        jdbc.update("""
                INSERT INTO transformer_alert_state
                    (transformer_id, supplier_code, depot_id, open_alert_count, total_alert_count, total_event_count,
                     last_alert_id, last_alert_at, last_alert_message, last_case_status, recent_alerts_json, updated_at)
                SELECT :id, t.supplier_code, t.depot_id, :openCount, :totalAlerts, :totalEvents,
                       :lastAlertId, :lastAlertAt, :lastMessage, :lastStatus, :recentJson, NOW(6)
                  FROM (SELECT 1) AS one
                  LEFT JOIN transformers t ON t.id = :id
                ON DUPLICATE KEY UPDATE
                    supplier_code      = VALUES(supplier_code),
                    depot_id           = VALUES(depot_id),
                    open_alert_count   = VALUES(open_alert_count),
                    total_alert_count  = VALUES(total_alert_count),
                    total_event_count  = VALUES(total_event_count),
                    last_alert_id      = VALUES(last_alert_id),
                    last_alert_at      = VALUES(last_alert_at),
                    last_alert_message = VALUES(last_alert_message),
                    last_case_status   = VALUES(last_case_status),
                    recent_alerts_json = VALUES(recent_alerts_json),
                    updated_at         = NOW(6)
                """, upsert);
    }

    /** Rebuild every transformer's snapshot (87 transformers ≈ a few hundred small queries). */
    public int rebuildAll() {
        List<Long> ids = jdbc.queryForList(
                "SELECT id FROM transformers UNION SELECT DISTINCT transformer_id FROM transformer_alert_state",
                new MapSqlParameterSource(), Long.class);
        int ok = 0;
        for (Long id : ids) {
            try {
                refresh(id);
                ok++;
            } catch (Exception ex) {
                log.warn("Alert state refresh failed for transformer {}: {}", id, ex.getMessage());
            }
        }
        log.info("Alert state rebuilt for {}/{} transformers", ok, ids.size());
        return ok;
    }

    /** Keep the snapshot table correct after deploys / manual SQL without anyone remembering to rebuild. */
    @Async
    @EventListener(ApplicationReadyEvent.class)
    public void rebuildOnStartup() {
        try {
            rebuildAll();
        } catch (Exception ex) {
            log.warn("Alert state rebuild on startup skipped: {}", ex.getMessage());
        }
    }

    public List<TransformerAlertStateResponse> list(String supplierCode, Long depotId, boolean openOnly) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        List<String> clauses = new ArrayList<>();
        if (supplierCode != null && !supplierCode.isBlank()) {
            clauses.add("s.supplier_code = :supplierCode");
            params.addValue("supplierCode", supplierCode);
        }
        if (depotId != null) {
            clauses.add("s.depot_id = :depotId");
            params.addValue("depotId", depotId);
        }
        if (openOnly) {
            clauses.add("s.open_alert_count > 0");
        } else {
            clauses.add("s.total_alert_count > 0");
        }
        String sql = "SELECT s.*, t.name AS transformer_name FROM transformer_alert_state s"
                + " LEFT JOIN transformers t ON t.id = s.transformer_id"
                + " WHERE " + String.join(" AND ", clauses)
                + " ORDER BY s.last_alert_at DESC";
        return jdbc.query(sql, params, (rs, i) -> mapState(rs));
    }

    public Optional<TransformerAlertStateResponse> get(Long transformerId) {
        List<TransformerAlertStateResponse> rows = jdbc.query(
                "SELECT s.*, t.name AS transformer_name FROM transformer_alert_state s"
                        + " LEFT JOIN transformers t ON t.id = s.transformer_id WHERE s.transformer_id = :id",
                new MapSqlParameterSource("id", transformerId), (rs, i) -> mapState(rs));
        return rows.stream().findFirst();
    }

    private TransformerAlertStateResponse mapState(java.sql.ResultSet rs) throws java.sql.SQLException {
        long lastAlertId = rs.getLong("last_alert_id");
        boolean lastAlertNull = rs.wasNull();
        long depot = rs.getLong("depot_id");
        boolean depotNull = rs.wasNull();
        return TransformerAlertStateResponse.builder()
                .transformerId(rs.getLong("transformer_id"))
                .transformerName(rs.getString("transformer_name"))
                .supplierCode(rs.getString("supplier_code"))
                .depotId(depotNull ? null : depot)
                .openAlertCount(rs.getInt("open_alert_count"))
                .totalAlertCount(rs.getLong("total_alert_count"))
                .totalEventCount(rs.getLong("total_event_count"))
                .lastAlertId(lastAlertNull ? null : lastAlertId)
                .lastAlertAt(toLdt(rs.getTimestamp("last_alert_at")))
                .lastAlertMessage(rs.getString("last_alert_message"))
                .lastCaseStatus(rs.getString("last_case_status"))
                .recentAlerts(readJson(rs.getString("recent_alerts_json")))
                .updatedAt(toLdt(rs.getTimestamp("updated_at")))
                .build();
    }

    private String writeJson(List<TransformerAlertStateResponse.RecentAlert> recent) {
        try {
            return objectMapper.writeValueAsString(recent);
        } catch (Exception ex) {
            return "[]";
        }
    }

    private List<TransformerAlertStateResponse.RecentAlert> readJson(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<TransformerAlertStateResponse.RecentAlert>>() { });
        } catch (Exception ex) {
            return List.of();
        }
    }

    private static LocalDateTime toLdt(Timestamp t) {
        return t != null ? t.toLocalDateTime() : null;
    }

    private static long toLong(Object value) {
        return value instanceof Number n ? n.longValue() : 0L;
    }

    private static String truncate(String value, int max) {
        if (value == null || value.length() <= max) {
            return value;
        }
        return value.substring(0, max);
    }
}
