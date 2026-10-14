package com.safalifter.transformerservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Keeps the alerts table small. Every night it deletes alerts that are
 * - closed (case RESOLVED or FALSE_ALARM),
 * - older than alerts.retention.closed-days (default 90), and
 * - not among the 3 newest alerts of their transformer (those stay for the snapshot).
 *
 * Open alerts are never deleted. Work is done in small batches so the job never holds
 * long locks on the live table.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AlertRetentionJob {

    private final NamedParameterJdbcTemplate jdbc;
    private final AlertStateService alertStateService;

    @Value("${alerts.retention.enabled:true}")
    private boolean enabled = true;

    @Value("${alerts.retention.closed-days:90}")
    private int closedDays = 90;

    @Value("${alerts.retention.batch-size:500}")
    private int batchSize = 500;

    @Value("${alerts.retention.max-batches-per-run:200}")
    private int maxBatches = 200;

    @Scheduled(cron = "${alerts.retention.cron:0 30 2 * * *}")
    public void purgeClosedAlerts() {
        if (!enabled) {
            return;
        }
        LocalDateTime cutoff = LocalDateTime.now().minusDays(closedDays);
        Set<Long> touchedTransformers = new HashSet<>();
        long deleted = 0;
        try {
            for (int batch = 0; batch < maxBatches; batch++) {
                MapSqlParameterSource params = new MapSqlParameterSource()
                        .addValue("cutoff", Timestamp.valueOf(cutoff))
                        .addValue("keep", AlertStateService.RECENT_ALERTS_KEPT)
                        .addValue("limit", batchSize);
                List<java.util.Map<String, Object>> rows = jdbc.queryForList("""
                        SELECT a.id, a.transformer_id, c.id AS case_id
                          FROM alerts a
                          JOIN alert_cases c ON c.alert_id = a.id
                         WHERE c.status IN ('RESOLVED', 'FALSE_ALARM')
                           AND a.created_at < :cutoff
                           AND a.transformer_id IS NOT NULL
                           AND (SELECT COUNT(*) FROM alerts n
                                 WHERE n.transformer_id = a.transformer_id AND n.id > a.id) >= :keep
                         ORDER BY a.id
                         LIMIT :limit
                        """, params);
                if (rows.isEmpty()) {
                    break;
                }
                List<Long> alertIds = rows.stream().map(r -> ((Number) r.get("id")).longValue()).toList();
                List<Long> caseIds = rows.stream().map(r -> ((Number) r.get("case_id")).longValue()).toList();
                rows.forEach(r -> touchedTransformers.add(((Number) r.get("transformer_id")).longValue()));

                MapSqlParameterSource ids = new MapSqlParameterSource()
                        .addValue("alertIds", alertIds)
                        .addValue("caseIds", caseIds);
                jdbc.update("DELETE FROM alert_case_activities WHERE alert_case_id IN (:caseIds)", ids);
                jdbc.update("DELETE FROM alert_cases WHERE id IN (:caseIds)", ids);
                deleted += jdbc.update("DELETE FROM alerts WHERE id IN (:alertIds)", ids);
            }
        } catch (Exception ex) {
            log.warn("Alert retention run stopped early: {}", ex.getMessage());
        }
        touchedTransformers.forEach(id -> {
            try {
                alertStateService.refresh(id);
            } catch (Exception ex) {
                log.warn("Alert state refresh failed for transformer {}: {}", id, ex.getMessage());
            }
        });
        if (deleted > 0) {
            log.info("Alert retention removed {} closed alerts older than {} days", deleted, closedDays);
        }
    }
}
