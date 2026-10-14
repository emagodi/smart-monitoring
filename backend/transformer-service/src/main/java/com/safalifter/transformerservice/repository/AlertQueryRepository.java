package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.enums.AlertCaseStatus;
import com.safalifter.transformerservice.payload.response.AlertResponse;
import com.safalifter.transformerservice.payload.response.AlertSummaryResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Hand-written SQL for the alert read paths.
 *
 * Why not Spring Data derived queries: every list request used to run
 * "ORDER BY created_at" + a separate alert_cases lookup + a full COUNT(*) on a
 * multi-million-row table. Here a single statement returns alert + case columns,
 * ordered by the primary key (no filesort) and filtered on indexed columns
 * (see db-init/20261015_alert_consolidation.sql).
 *
 * Plain JdbcTemplate is used deliberately: no @Query parsing at boot, so a typo
 * here can never stop transformer-service from starting.
 */
@Repository
@RequiredArgsConstructor
public class AlertQueryRepository {

    public static final List<String> OPEN_STATUSES = List.of(
            AlertCaseStatus.NEW.name(), AlertCaseStatus.ACKNOWLEDGED.name(), AlertCaseStatus.DISPATCHED.name());

    /** Effective case status: alerts without a case row fall back like the UI did. */
    private static final String EFFECTIVE_STATUS = "COALESCE(c.status, CASE WHEN a.is_alert = 1 THEN 'NEW' ELSE 'RESOLVED' END)";

    private static final String SELECT_COLUMNS = """
            SELECT a.id, a.sensor_id, a.camera_id, a.value, a.is_alert, a.message,
                   a.transformer_id, a.transformer_name, a.transformer_capacity,
                   a.depot_id, a.depot_name, a.lat, a.lng, a.dev_eui, a.device_id, a.device_name,
                   a.sensor_type, a.supplier_code, a.supplier_name, a.image_url,
                   a.created_at, a.updated_at, a.occurrence_count, a.last_seen_at, a.last_notified_at,
                   c.id AS case_id, c.status AS case_status, c.assigned_to_email, c.assigned_to_name,
                   c.assigned_at, c.acknowledged_at, c.dispatched_at, c.resolved_at, c.false_alarm_at,
                   c.last_action_at, c.last_action_by_email, c.last_action_by_name, c.last_action_note
              FROM alerts a
              LEFT JOIN alert_cases c ON c.alert_id = a.id
            """;

    private final NamedParameterJdbcTemplate jdbc;

    /** Filters accepted by the list endpoint. All fields are optional. */
    public record AlertFilter(String supplierCode, Long depotId, String status, Long transformerId, String search) {
    }

    public List<AlertResponse> findPage(AlertFilter filter, int page, int size) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        String where = buildWhere(filter, params);
        params.addValue("limit", size);
        params.addValue("offset", (long) page * size);
        String sql = SELECT_COLUMNS + where + " ORDER BY a.id DESC LIMIT :limit OFFSET :offset";
        return jdbc.query(sql, params, ALERT_ROW_MAPPER);
    }

    public long count(AlertFilter filter) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        String where = buildWhere(filter, params);
        boolean needsCaseJoin = filter.status() != null && !filter.status().isBlank();
        String sql = "SELECT COUNT(*) FROM alerts a"
                + (needsCaseJoin ? " LEFT JOIN alert_cases c ON c.alert_id = a.id" : "")
                + where;
        Long total = jdbc.queryForObject(sql, params, Long.class);
        return total != null ? total : 0L;
    }

    public Optional<AlertResponse> findById(Long id) {
        MapSqlParameterSource params = new MapSqlParameterSource("id", id);
        List<AlertResponse> rows = jdbc.query(SELECT_COLUMNS + " WHERE a.id = :id", params, ALERT_ROW_MAPPER);
        return rows.stream().findFirst();
    }

    /**
     * Newest alert for the same transformer + device/sensor whose case is still open.
     * Uses idx_alerts_transformer_id (transformer_id, id) so it is an index range scan
     * over that transformer's handful of rows, never a table scan.
     */
    public Optional<Long> findOpenAlertId(Long transformerId, Long sensorId, String deviceId, String sensorType) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("transformerId", transformerId)
                .addValue("sensorId", sensorId)
                .addValue("deviceId", deviceId)
                .addValue("sensorType", sensorType)
                .addValue("openStatuses", OPEN_STATUSES);
        String sql = """
                SELECT a.id
                  FROM alerts a
                  JOIN alert_cases c ON c.alert_id = a.id
                 WHERE a.transformer_id <=> :transformerId
                   AND a.sensor_id <=> :sensorId
                   AND a.device_id <=> :deviceId
                   AND a.sensor_type <=> :sensorType
                   AND c.status IN (:openStatuses)
                 ORDER BY a.id DESC
                 LIMIT 1
                """;
        List<Long> ids = jdbc.queryForList(sql, params, Long.class);
        return ids.stream().findFirst();
    }

    public AlertSummaryResponse summary(String supplierCode, Long depotId) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        String scope = buildWhere(new AlertFilter(supplierCode, depotId, null, null, null), params);
        params.addValue("openStatuses", OPEN_STATUSES);

        String countsSql = "SELECT " + EFFECTIVE_STATUS + " AS st, COUNT(*) AS n,"
                + " COALESCE(SUM(a.occurrence_count), 0) AS events,"
                + " SUM(CASE WHEN c.assigned_to_email IS NULL AND c.assigned_to_name IS NULL THEN 1 ELSE 0 END) AS unassigned"
                + " FROM alerts a LEFT JOIN alert_cases c ON c.alert_id = a.id"
                + scope
                + " GROUP BY st";

        AlertSummaryResponse.AlertSummaryResponseBuilder out = AlertSummaryResponse.builder();
        long total = 0, events = 0, open = 0, unassigned = 0;
        for (Map<String, Object> row : jdbc.queryForList(countsSql, params)) {
            String status = String.valueOf(row.get("st")).toUpperCase(Locale.ROOT);
            long n = toLong(row.get("n"));
            total += n;
            events += toLong(row.get("events"));
            switch (status) {
                case "NEW" -> out.newCount(n);
                case "ACKNOWLEDGED" -> out.acknowledged(n);
                case "DISPATCHED" -> out.dispatched(n);
                case "RESOLVED" -> out.resolved(n);
                case "FALSE_ALARM" -> out.falseAlarm(n);
                default -> { }
            }
            if (OPEN_STATUSES.contains(status)) {
                open += n;
                unassigned += toLong(row.get("unassigned"));
            }
        }

        String last24Sql = "SELECT COUNT(*) FROM alerts a" + scope
                + (scope.isEmpty() ? " WHERE" : " AND") + " a.created_at >= :since";
        params.addValue("since", Timestamp.valueOf(LocalDateTime.now().minusHours(24)));
        Long last24h = jdbc.queryForObject(last24Sql, params, Long.class);

        params.addValue("monthsBack", Timestamp.valueOf(LocalDateTime.now().minusMonths(12).withDayOfMonth(1).toLocalDate().atStartOfDay()));
        String monthlySql = "SELECT DATE_FORMAT(a.created_at, '%Y-%m') AS m, COUNT(*) AS n, COALESCE(SUM(a.occurrence_count), 0) AS events"
                + " FROM alerts a" + scope
                + (scope.isEmpty() ? " WHERE" : " AND") + " a.created_at >= :monthsBack"
                + " GROUP BY m ORDER BY m";
        List<AlertSummaryResponse.MonthlyCount> monthly = new ArrayList<>();
        for (Map<String, Object> row : jdbc.queryForList(monthlySql, params)) {
            monthly.add(AlertSummaryResponse.MonthlyCount.builder()
                    .month(String.valueOf(row.get("m")))
                    .alerts(toLong(row.get("n")))
                    .events(toLong(row.get("events")))
                    .build());
        }

        return out.total(total)
                .open(open)
                .unassigned(unassigned)
                .totalEvents(events)
                .last24h(last24h != null ? last24h : 0L)
                .monthly(monthly)
                .build();
    }

    private String buildWhere(AlertFilter filter, MapSqlParameterSource params) {
        List<String> clauses = new ArrayList<>();
        if (filter.supplierCode() != null && !filter.supplierCode().isBlank()) {
            clauses.add("a.supplier_code = :supplierCode");
            params.addValue("supplierCode", filter.supplierCode());
        }
        if (filter.depotId() != null) {
            clauses.add("a.depot_id = :depotId");
            params.addValue("depotId", filter.depotId());
        }
        if (filter.transformerId() != null) {
            clauses.add("a.transformer_id = :transformerId");
            params.addValue("transformerId", filter.transformerId());
        }
        String status = filter.status() != null ? filter.status().trim().toUpperCase(Locale.ROOT) : "";
        switch (status) {
            case "" , "ALL" -> { }
            case "OPEN" -> {
                clauses.add(EFFECTIVE_STATUS + " IN (:openStatuses)");
                params.addValue("openStatuses", OPEN_STATUSES);
            }
            case "UNASSIGNED" -> {
                clauses.add(EFFECTIVE_STATUS + " IN (:openStatuses)");
                clauses.add("c.assigned_to_email IS NULL AND c.assigned_to_name IS NULL");
                params.addValue("openStatuses", OPEN_STATUSES);
            }
            case "NEW", "ACKNOWLEDGED", "DISPATCHED", "RESOLVED", "FALSE_ALARM" -> {
                clauses.add(EFFECTIVE_STATUS + " = :status");
                params.addValue("status", status);
            }
            default -> { }
        }
        if (filter.search() != null && !filter.search().isBlank()) {
            clauses.add("(a.transformer_name LIKE :q OR a.device_name LIKE :q OR a.device_id LIKE :q"
                    + " OR a.depot_name LIKE :q OR a.message LIKE :q)");
            params.addValue("q", "%" + filter.search().trim() + "%");
        }
        return clauses.isEmpty() ? "" : " WHERE " + String.join(" AND ", clauses);
    }

    private static long toLong(Object value) {
        return value instanceof Number n ? n.longValue() : 0L;
    }

    private static LocalDateTime ts(ResultSet rs, String column) throws SQLException {
        Timestamp t = rs.getTimestamp(column);
        return t != null ? t.toLocalDateTime() : null;
    }

    private static Long nullableLong(ResultSet rs, String column) throws SQLException {
        long v = rs.getLong(column);
        return rs.wasNull() ? null : v;
    }

    private static Integer nullableInt(ResultSet rs, String column) throws SQLException {
        int v = rs.getInt(column);
        return rs.wasNull() ? null : v;
    }

    private static AlertCaseStatus caseStatus(String raw) {
        if (raw == null) {
            return null;
        }
        try {
            return AlertCaseStatus.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    public static final RowMapper<AlertResponse> ALERT_ROW_MAPPER = (rs, rowNum) -> AlertResponse.builder()
            .id(rs.getLong("id"))
            .sensorId(nullableLong(rs, "sensor_id"))
            .cameraId(nullableLong(rs, "camera_id"))
            .value(rs.getString("value"))
            .isAlert(rs.getBoolean("is_alert"))
            .message(rs.getString("message"))
            .transformerId(nullableLong(rs, "transformer_id"))
            .transformerName(rs.getString("transformer_name"))
            .transformerCapacity(nullableInt(rs, "transformer_capacity"))
            .depotId(nullableLong(rs, "depot_id"))
            .depotName(rs.getString("depot_name"))
            .lat(rs.getBigDecimal("lat"))
            .lng(rs.getBigDecimal("lng"))
            .devEui(rs.getString("dev_eui"))
            .deviceId(rs.getString("device_id"))
            .deviceName(rs.getString("device_name"))
            .sensorType(rs.getString("sensor_type"))
            .supplierCode(rs.getString("supplier_code"))
            .supplierName(rs.getString("supplier_name"))
            .imageUrl(rs.getString("image_url"))
            .createdAt(ts(rs, "created_at"))
            .updatedAt(ts(rs, "updated_at"))
            .occurrenceCount(nullableInt(rs, "occurrence_count"))
            .lastSeenAt(ts(rs, "last_seen_at"))
            .lastNotifiedAt(ts(rs, "last_notified_at"))
            .caseId(nullableLong(rs, "case_id"))
            .caseStatus(caseStatus(rs.getString("case_status")))
            .assignedToEmail(rs.getString("assigned_to_email"))
            .assignedToName(rs.getString("assigned_to_name"))
            .assignedAt(ts(rs, "assigned_at"))
            .acknowledgedAt(ts(rs, "acknowledged_at"))
            .dispatchedAt(ts(rs, "dispatched_at"))
            .resolvedAt(ts(rs, "resolved_at"))
            .falseAlarmAt(ts(rs, "false_alarm_at"))
            .lastActionAt(ts(rs, "last_action_at"))
            .lastActionByEmail(rs.getString("last_action_by_email"))
            .lastActionByName(rs.getString("last_action_by_name"))
            .lastActionNote(rs.getString("last_action_note"))
            .build();
}
