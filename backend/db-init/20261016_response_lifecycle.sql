-- ============================================================================
-- INCIDENT RESPONSE LIFECYCLE                            (database: tms, MySQL 8)
-- ============================================================================
-- Adds: response stages (EN_ROUTE, ON_SCENE), outcomes, response vehicles (fleet),
--       dispatches with crew links.
-- Safe to run more than once. Additive only: no data is deleted.
-- Run BEFORE starting the new transformer-service build:
--   mysql -h 192.168.15.228 -u root -p tms < backend/db-init/20261016_response_lifecycle.sql
-- ============================================================================

DELIMITER $$

DROP PROCEDURE IF EXISTS _rl_exec $$
CREATE PROCEDURE _rl_exec(IN stmt TEXT)
BEGIN
    SET @_rl_sql = stmt;
    PREPARE _rl_ps FROM @_rl_sql;
    EXECUTE _rl_ps;
    DEALLOCATE PREPARE _rl_ps;
END $$

DROP FUNCTION IF EXISTS _rl_col_type $$
CREATE FUNCTION _rl_col_type(tbl VARCHAR(64), col VARCHAR(64)) RETURNS VARCHAR(64)
READS SQL DATA
BEGIN
    RETURN (SELECT DATA_TYPE FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col LIMIT 1);
END $$

DROP FUNCTION IF EXISTS _rl_index_exists $$
CREATE FUNCTION _rl_index_exists(tbl VARCHAR(64), idx VARCHAR(64)) RETURNS TINYINT
READS SQL DATA
BEGIN
    RETURN (SELECT COUNT(*) > 0 FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND INDEX_NAME = idx);
END $$

DROP PROCEDURE IF EXISTS _rl_add_col $$
CREATE PROCEDURE _rl_add_col(IN tbl VARCHAR(64), IN col VARCHAR(64), IN ddl VARCHAR(255))
BEGIN
    IF _rl_col_type(tbl, col) IS NULL THEN
        CALL _rl_exec(CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', ddl));
    END IF;
END $$

-- Hibernate created these as MySQL ENUM columns; new stages would be rejected
-- ("Data truncated"), so they become VARCHAR. Values are unchanged.
DROP PROCEDURE IF EXISTS _rl_enum_to_varchar $$
CREATE PROCEDURE _rl_enum_to_varchar(IN tbl VARCHAR(64), IN col VARCHAR(64), IN nullable TINYINT)
BEGIN
    IF _rl_col_type(tbl, col) = 'enum' THEN
        CALL _rl_exec(CONCAT('ALTER TABLE `', tbl, '` MODIFY COLUMN `', col, '` VARCHAR(32) ',
                             IF(nullable = 1, 'NULL', 'NOT NULL')));
    END IF;
END $$

DROP PROCEDURE IF EXISTS _rl_migrate $$
CREATE PROCEDURE _rl_migrate()
BEGIN
    -- 1. alert_cases: free-form status + lifecycle columns
    CALL _rl_enum_to_varchar('alert_cases', 'status', 0);
    CALL _rl_add_col('alert_cases', 'en_route_at',    'DATETIME(6) NULL');
    CALL _rl_add_col('alert_cases', 'on_scene_at',    'DATETIME(6) NULL');
    CALL _rl_add_col('alert_cases', 'closed_at',      'DATETIME(6) NULL');
    CALL _rl_add_col('alert_cases', 'outcome',        'VARCHAR(32) NULL');
    CALL _rl_add_col('alert_cases', 'outcome_note',   'VARCHAR(2000) NULL');
    CALL _rl_add_col('alert_cases', 'closed_by_name', 'VARCHAR(255) NULL');
    IF NOT _rl_index_exists('alert_cases', 'idx_alert_cases_closed_at') THEN
        CALL _rl_exec('CREATE INDEX idx_alert_cases_closed_at ON alert_cases (closed_at)');
    END IF;

    -- 2. alert_case_activities: new activity types
    CALL _rl_enum_to_varchar('alert_case_activities', 'activity_type', 0);
    CALL _rl_enum_to_varchar('alert_case_activities', 'status_before', 1);
    CALL _rl_enum_to_varchar('alert_case_activities', 'status_after', 1);

    -- 3. backfill closure data for cases closed before this release
    UPDATE alert_cases
       SET closed_at = COALESCE(resolved_at, false_alarm_at, last_action_at, updated_at)
     WHERE closed_at IS NULL AND status IN ('RESOLVED', 'FALSE_ALARM');
    UPDATE alert_cases
       SET outcome = 'FALSE_ALARM'
     WHERE outcome IS NULL AND status = 'FALSE_ALARM';
END $$

DELIMITER ;

CALL _rl_migrate();

-- 4. Rapid-response fleet
CREATE TABLE IF NOT EXISTS response_vehicles (
    id                 BIGINT        NOT NULL AUTO_INCREMENT,
    registration       VARCHAR(32)   NOT NULL,
    call_sign          VARCHAR(64)   NULL,
    vehicle_type       VARCHAR(64)   NULL,
    depot_id           BIGINT        NULL,
    depot_name         VARCHAR(255)  NULL,
    status             VARCHAR(32)   NOT NULL DEFAULT 'AVAILABLE',
    crew_lead_name     VARCHAR(255)  NULL,
    crew_lead_phone    VARCHAR(32)   NULL,
    crew_lead_whatsapp VARCHAR(32)   NULL,
    crew_lead_email    VARCHAR(255)  NULL,
    crew_size          INT           NULL,
    notes              VARCHAR(1000) NULL,
    active             BIT(1)        NOT NULL DEFAULT b'1',
    created_at         DATETIME(6)   NULL,
    updated_at         DATETIME(6)   NULL,
    PRIMARY KEY (id),
    KEY idx_rv_depot (depot_id, active),
    KEY idx_rv_registration (registration)
) ENGINE = InnoDB;

-- 5. Dispatches (one row per vehicle sent to an incident)
CREATE TABLE IF NOT EXISTS alert_dispatches (
    id                   BIGINT        NOT NULL AUTO_INCREMENT,
    alert_case_id        BIGINT        NOT NULL,
    alert_id             BIGINT        NOT NULL,
    vehicle_id           BIGINT        NULL,
    vehicle_registration VARCHAR(32)   NULL,
    vehicle_call_sign    VARCHAR(64)   NULL,
    crew_lead_name       VARCHAR(255)  NULL,
    crew_lead_phone      VARCHAR(32)   NULL,
    crew_lead_whatsapp   VARCHAR(32)   NULL,
    crew_lead_email      VARCHAR(255)  NULL,
    status               VARCHAR(32)   NOT NULL,
    crew_token           VARCHAR(64)   NOT NULL,
    dispatched_by_email  VARCHAR(255)  NULL,
    dispatch_note        VARCHAR(1000) NULL,
    dispatched_at        DATETIME(6)   NULL,
    accepted_at          DATETIME(6)   NULL,
    on_scene_at          DATETIME(6)   NULL,
    completed_at         DATETIME(6)   NULL,
    cancelled_at         DATETIME(6)   NULL,
    last_crew_note       VARCHAR(1000) NULL,
    created_at           DATETIME(6)   NULL,
    updated_at           DATETIME(6)   NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_ad_crew_token (crew_token),
    KEY idx_ad_case (alert_case_id, id),
    KEY idx_ad_vehicle_status (vehicle_id, status)
) ENGINE = InnoDB;

DROP PROCEDURE IF EXISTS _rl_migrate;
DROP PROCEDURE IF EXISTS _rl_enum_to_varchar;
DROP PROCEDURE IF EXISTS _rl_add_col;
DROP PROCEDURE IF EXISTS _rl_exec;
DROP FUNCTION IF EXISTS _rl_col_type;
DROP FUNCTION IF EXISTS _rl_index_exists;

SELECT 'response lifecycle schema ready' AS info,
       (SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'alert_cases' AND COLUMN_NAME = 'status') AS alert_case_status_type;
