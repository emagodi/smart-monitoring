package com.safalifter.transformerservice.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Brings the database schema up to what this build expects, every startup, idempotently.
 *
 * Why: ddl-auto is "none" (Hibernate must not touch the live schema), and the MySQL container only
 * runs backend/db-init/*.sql when a brand-new volume is created. Existing databases (local docker
 * volumes, the live server) therefore never received new tables/columns, and the new screens failed
 * with 500s. This runner applies only ADDITIVE changes (create table if missing, add column if
 * missing, add index if missing, widen MySQL ENUM status columns to VARCHAR). It never drops or
 * deletes data. The one-time alert consolidation (20261015 part 1) is NOT run here; that stays a
 * deliberate manual step.
 *
 * Disable with schema.auto-upgrade=false.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
@Slf4j
public class SchemaUpgrader implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    @Value("${schema.auto-upgrade:true}")
    private boolean enabled = true;

    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) {
            log.info("Schema auto-upgrade disabled");
            return;
        }
        int changes = 0;
        try {
            changes += step("transformers telemetry columns", () -> {
                int c = 0;
                c += addColumn("transformers", "last_telemetry_at", "DATETIME(3) NULL");
                c += addColumn("transformers", "last_command_at", "DATETIME(3) NULL");
                c += addIndex("transformers", "idx_transformers_depot", "depot_id");
                c += addIndex("transformers", "idx_transformers_supplier", "supplier_code");
                return c;
            });
            changes += step("controllers denormalised columns", () -> {
                int c = 0;
                c += addColumn("controllers", "last_reading_at", "DATETIME(3) NULL");
                c += addColumn("controllers", "last_reading_di1", "TINYINT(1) NULL");
                c += addColumn("controllers", "last_reading_di2", "TINYINT(1) NULL");
                c += addColumn("controllers", "last_reading_battery", "INT NULL");
                c += addColumn("controllers", "last_reading_rssi", "INT NULL");
                c += addColumn("controllers", "last_reading_snr", "INT NULL");
                c += addColumn("controllers", "last_reading_decoded_payload", "TEXT NULL");
                c += addColumn("controllers", "last_command_at", "DATETIME(3) NULL");
                c += addColumn("controllers", "last_command_action", "VARCHAR(50) NULL");
                c += addColumn("controllers", "last_command_status", "VARCHAR(50) NULL");
                c += addColumn("controllers", "last_command_requested_by", "VARCHAR(255) NULL");
                c += addIndex("controllers", "idx_controllers_transformer", "transformer_id");
                c += addIndex("controllers", "idx_controllers_dev_eui", "dev_eui");
                c += addIndex("controllers", "idx_controllers_supplier_tx", "supplier_code, transformer_id");
                return c;
            });
            changes += step("alerts (consolidation columns + indexes)", () -> {
                int c = 0;
                c += addColumn("alerts", "occurrence_count", "INT NOT NULL DEFAULT 1");
                c += addColumn("alerts", "last_seen_at", "DATETIME(6) NULL");
                c += addColumn("alerts", "last_notified_at", "DATETIME(6) NULL");
                c += addIndex("alerts", "idx_alerts_transformer_id", "transformer_id, id");
                c += addIndex("alerts", "idx_alerts_supplier_id", "supplier_code, id");
                c += addIndex("alerts", "idx_alerts_depot_id", "depot_id, id");
                c += addIndex("alerts", "idx_alerts_sensor_id", "sensor_id, id");
                c += addIndex("alerts", "idx_alerts_created_at", "created_at");
                return c;
            });
            changes += step("alert cases (response lifecycle)", () -> {
                int c = 0;
                c += enumToVarchar("alert_cases", "status", false);
                c += addColumn("alert_cases", "en_route_at", "DATETIME(6) NULL");
                c += addColumn("alert_cases", "on_scene_at", "DATETIME(6) NULL");
                c += addColumn("alert_cases", "closed_at", "DATETIME(6) NULL");
                c += addColumn("alert_cases", "outcome", "VARCHAR(32) NULL");
                c += addColumn("alert_cases", "outcome_note", "VARCHAR(2000) NULL");
                c += addColumn("alert_cases", "closed_by_name", "VARCHAR(255) NULL");
                c += addIndex("alert_cases", "idx_alert_cases_status", "status, alert_id");
                c += addIndex("alert_cases", "idx_alert_cases_closed_at", "closed_at");
                c += enumToVarchar("alert_case_activities", "activity_type", false);
                c += enumToVarchar("alert_case_activities", "status_before", true);
                c += enumToVarchar("alert_case_activities", "status_after", true);
                c += addIndex("alert_case_activities", "idx_aca_case_created", "alert_case_id, created_at");
                return c;
            });
            changes += step("transformer_alert_state", () -> createTable("transformer_alert_state", """
                    CREATE TABLE IF NOT EXISTS transformer_alert_state (
                        transformer_id      BIGINT        NOT NULL,
                        supplier_code       VARCHAR(255)  NULL,
                        depot_id            BIGINT        NULL,
                        open_alert_count    INT           NOT NULL DEFAULT 0,
                        total_alert_count   BIGINT        NOT NULL DEFAULT 0,
                        total_event_count   BIGINT        NOT NULL DEFAULT 0,
                        last_alert_id       BIGINT        NULL,
                        last_alert_at       DATETIME(6)   NULL,
                        last_alert_message  VARCHAR(1000) NULL,
                        last_case_status    VARCHAR(32)   NULL,
                        recent_alerts_json  TEXT          NULL,
                        updated_at          DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                        PRIMARY KEY (transformer_id),
                        KEY idx_tas_supplier (supplier_code),
                        KEY idx_tas_depot (depot_id),
                        KEY idx_tas_last_alert_at (last_alert_at)
                    ) ENGINE = InnoDB
                    """));
            changes += step("response fleet + dispatches", () -> {
                int c = 0;
                c += createTable("response_vehicles", """
                        CREATE TABLE IF NOT EXISTS response_vehicles (
                            id BIGINT NOT NULL AUTO_INCREMENT,
                            registration VARCHAR(32) NOT NULL,
                            call_sign VARCHAR(64) NULL,
                            vehicle_type VARCHAR(64) NULL,
                            depot_id BIGINT NULL,
                            depot_name VARCHAR(255) NULL,
                            status VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE',
                            crew_lead_name VARCHAR(255) NULL,
                            crew_lead_phone VARCHAR(32) NULL,
                            crew_lead_whatsapp VARCHAR(32) NULL,
                            crew_lead_email VARCHAR(255) NULL,
                            crew_size INT NULL,
                            notes VARCHAR(1000) NULL,
                            active BIT(1) NOT NULL DEFAULT b'1',
                            created_at DATETIME(6) NULL,
                            updated_at DATETIME(6) NULL,
                            PRIMARY KEY (id),
                            KEY idx_rv_depot (depot_id, active),
                            KEY idx_rv_registration (registration)
                        ) ENGINE = InnoDB
                        """);
                c += createTable("alert_dispatches", """
                        CREATE TABLE IF NOT EXISTS alert_dispatches (
                            id BIGINT NOT NULL AUTO_INCREMENT,
                            alert_case_id BIGINT NOT NULL,
                            alert_id BIGINT NOT NULL,
                            vehicle_id BIGINT NULL,
                            vehicle_registration VARCHAR(32) NULL,
                            vehicle_call_sign VARCHAR(64) NULL,
                            crew_lead_name VARCHAR(255) NULL,
                            crew_lead_phone VARCHAR(32) NULL,
                            crew_lead_whatsapp VARCHAR(32) NULL,
                            crew_lead_email VARCHAR(255) NULL,
                            status VARCHAR(32) NOT NULL,
                            crew_token VARCHAR(64) NOT NULL,
                            dispatched_by_email VARCHAR(255) NULL,
                            dispatch_note VARCHAR(1000) NULL,
                            dispatched_at DATETIME(6) NULL,
                            accepted_at DATETIME(6) NULL,
                            on_scene_at DATETIME(6) NULL,
                            completed_at DATETIME(6) NULL,
                            cancelled_at DATETIME(6) NULL,
                            last_crew_note VARCHAR(1000) NULL,
                            created_at DATETIME(6) NULL,
                            updated_at DATETIME(6) NULL,
                            PRIMARY KEY (id),
                            UNIQUE KEY uk_ad_crew_token (crew_token),
                            KEY idx_ad_case (alert_case_id, id),
                            KEY idx_ad_vehicle_status (vehicle_id, status)
                        ) ENGINE = InnoDB
                        """);
                return c;
            });
            changes += step("supplier integrations", () -> {
                int c = createTable("supplier_integrations", """
                        CREATE TABLE IF NOT EXISTS supplier_integrations (
                            id BIGINT NOT NULL AUTO_INCREMENT,
                            supplier_code VARCHAR(64) NOT NULL,
                            supplier_name VARCHAR(255) NULL,
                            name VARCHAR(255) NOT NULL,
                            transport VARCHAR(32) NOT NULL,
                            endpoint_url VARCHAR(1000) NULL,
                            push_secret VARCHAR(128) NULL,
                            decoder_key VARCHAR(64) NOT NULL,
                            default_controller_type VARCHAR(64) NULL,
                            auto_register BIT(1) NOT NULL DEFAULT b'1',
                            enabled BIT(1) NOT NULL DEFAULT b'1',
                            status VARCHAR(32) NULL,
                            last_error VARCHAR(1000) NULL,
                            last_connected_at DATETIME(6) NULL,
                            last_message_at DATETIME(6) NULL,
                            messages_received BIGINT NOT NULL DEFAULT 0,
                            devices_registered BIGINT NOT NULL DEFAULT 0,
                            created_at DATETIME(6) NULL,
                            updated_at DATETIME(6) NULL,
                            PRIMARY KEY (id),
                            KEY idx_si_supplier (supplier_code),
                            KEY idx_si_enabled (enabled, transport)
                        ) ENGINE = InnoDB
                        """);
                c += jdbc.update("""
                        INSERT INTO supplier_integrations (supplier_code, supplier_name, name, transport, decoder_key,
                               default_controller_type, auto_register, enabled, status, created_at, updated_at)
                        SELECT 'oculus', 'Oculus', 'Oculus LORIOT application', 'LORIOT_WEBSOCKET', 'dragino-lt22222',
                               'DRAGINO_LT22222', b'1', b'0', 'STOPPED', NOW(6), NOW(6) FROM DUAL
                         WHERE NOT EXISTS (SELECT 1 FROM supplier_integrations WHERE supplier_code = 'oculus')
                        """);
                return c;
            });
            log.info("Schema auto-upgrade finished: {} change(s) applied", changes);
        } catch (Exception e) {
            // Never block startup; the failing step is already logged.
            log.error("Schema auto-upgrade stopped early: {}", e.getMessage());
        }
    }

    private interface Step {
        int apply();
    }

    private int step(String name, Step s) {
        try {
            int n = s.apply();
            if (n > 0) log.info("Schema upgrade [{}]: {} change(s)", name, n);
            return n;
        } catch (Exception e) {
            log.error("Schema upgrade [{}] failed: {}", name, e.getMessage());
            return 0;
        }
    }

    private boolean tableExists(String table) {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
                Integer.class, table);
        return n != null && n > 0;
    }

    private String columnType(String table, String column) {
        List<String> t = jdbc.queryForList("SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
                String.class, table, column);
        return t.isEmpty() ? null : t.get(0);
    }

    private int addColumn(String table, String column, String ddl) {
        if (!tableExists(table) || columnType(table, column) != null) return 0;
        jdbc.execute("ALTER TABLE `" + table + "` ADD COLUMN `" + column + "` " + ddl);
        return 1;
    }

    private int addIndex(String table, String index, String columns) {
        if (!tableExists(table)) return 0;
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",
                Integer.class, table, index);
        if (n != null && n > 0) return 0;
        jdbc.execute("CREATE INDEX " + index + " ON `" + table + "` (" + columns + ")");
        return 1;
    }

    private int enumToVarchar(String table, String column, boolean nullable) {
        if (!"enum".equalsIgnoreCase(columnType(table, column))) return 0;
        jdbc.execute("ALTER TABLE `" + table + "` MODIFY COLUMN `" + column + "` VARCHAR(32) " + (nullable ? "NULL" : "NOT NULL"));
        return 1;
    }

    private int createTable(String table, String ddl) {
        if (tableExists(table)) return 0;
        jdbc.execute(ddl);
        return 1;
    }
}
