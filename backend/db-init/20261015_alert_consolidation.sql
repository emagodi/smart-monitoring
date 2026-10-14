-- ============================================================================
-- ALERT CONSOLIDATION + ALERT SNAPSHOT TABLE            (database: tms, MySQL 8)
-- ============================================================================
-- What this does
--   PART 1  One-time clean-up of the alert flood (runs only once, guarded):
--           * keeps the 3 newest alerts per transformer
--             (+ any alert whose case is ACKNOWLEDGED / DISPATCHED, so work in progress is kept)
--           * the newest kept alert absorbs the count of the deleted rows in occurrence_count,
--             so the history total is not lost
--           * older duplicate OPEN cases of the same transformer/device are auto-closed
--             (set @auto_close_duplicates = 0 below to skip that)
--           * done by building small new tables and swapping them in with one atomic
--             RENAME. The old tables stay as *_bak_20261015 so this can be undone.
--   PART 2  Idempotent schema: new alert columns, indexes, transformer_alert_state table.
--           Safe to re-run any number of times.
--
-- How to run (transformer-service MUST be stopped during PART 1):
--   docker compose -f docker-compose.live.yml --env-file .env.live stop transformer-service
--   mysql -h 192.168.15.228 -u root -p tms < backend/db-init/20261015_alert_consolidation.sql
--   (deploy the new transformer-service image, then start it)
--
-- Undo PART 1 (before you drop the backups):
--   RENAME TABLE alerts TO alerts_consolidated, alerts_bak_20261015 TO alerts,
--                alert_cases TO alert_cases_consolidated, alert_cases_bak_20261015 TO alert_cases,
--                alert_case_activities TO alert_case_activities_consolidated,
--                alert_case_activities_bak_20261015 TO alert_case_activities;
--
-- Free the disk once you are happy (a few days later):
--   DROP TABLE alerts_bak_20261015, alert_cases_bak_20261015, alert_case_activities_bak_20261015;
-- ============================================================================

SET @auto_close_duplicates = 1;
SET @keep_per_transformer = 3;

DELIMITER $$

DROP PROCEDURE IF EXISTS _sm_exec $$
CREATE PROCEDURE _sm_exec(IN stmt TEXT)
BEGIN
    SET @_sm_sql = stmt;
    PREPARE _sm_ps FROM @_sm_sql;
    EXECUTE _sm_ps;
    DEALLOCATE PREPARE _sm_ps;
END $$

DROP FUNCTION IF EXISTS _sm_column_exists $$
CREATE FUNCTION _sm_column_exists(tbl VARCHAR(64), col VARCHAR(64)) RETURNS TINYINT
READS SQL DATA
BEGIN
    RETURN (SELECT COUNT(*) > 0 FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col);
END $$

DROP FUNCTION IF EXISTS _sm_index_exists $$
CREATE FUNCTION _sm_index_exists(tbl VARCHAR(64), idx VARCHAR(64)) RETURNS TINYINT
READS SQL DATA
BEGIN
    RETURN (SELECT COUNT(*) > 0 FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND INDEX_NAME = idx);
END $$

DROP FUNCTION IF EXISTS _sm_table_exists $$
CREATE FUNCTION _sm_table_exists(tbl VARCHAR(64)) RETURNS TINYINT
READS SQL DATA
BEGIN
    RETURN (SELECT COUNT(*) > 0 FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl);
END $$

DROP PROCEDURE IF EXISTS _sm_add_alert_columns $$
CREATE PROCEDURE _sm_add_alert_columns(IN tbl VARCHAR(64))
BEGIN
    IF NOT _sm_column_exists(tbl, 'occurrence_count') THEN
        CALL _sm_exec(CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN occurrence_count INT NOT NULL DEFAULT 1'));
    END IF;
    IF NOT _sm_column_exists(tbl, 'last_seen_at') THEN
        CALL _sm_exec(CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN last_seen_at DATETIME(6) NULL'));
    END IF;
    IF NOT _sm_column_exists(tbl, 'last_notified_at') THEN
        CALL _sm_exec(CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN last_notified_at DATETIME(6) NULL'));
    END IF;
END $$

-- ----------------------------------------------------------------------------
-- PART 1: one-time consolidation
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS _sm_consolidate_alerts $$
CREATE PROCEDURE _sm_consolidate_alerts()
proc: BEGIN
    DECLARE had_columns TINYINT DEFAULT 0;

    IF _sm_table_exists('alerts_bak_20261015') THEN
        SELECT 'PART 1 skipped: consolidation already ran (alerts_bak_20261015 exists)' AS info;
        LEAVE proc;
    END IF;

    SET had_columns = _sm_column_exists('alerts', 'occurrence_count');

    SELECT COUNT(*) INTO @alerts_before FROM alerts;

    -- 1. ids to keep: newest N per transformer + cases in progress
    DROP TABLE IF EXISTS _sm_keep;
    CREATE TABLE _sm_keep (
        id BIGINT NOT NULL PRIMARY KEY,
        transformer_id BIGINT NULL,
        rn INT NOT NULL,
        KEY (transformer_id, rn)
    ) ENGINE = InnoDB;

    INSERT INTO _sm_keep (id, transformer_id, rn)
    SELECT id, transformer_id, rn
      FROM (SELECT id, transformer_id,
                   ROW_NUMBER() OVER (PARTITION BY transformer_id ORDER BY id DESC) AS rn
              FROM alerts) ranked
     WHERE rn <= @keep_per_transformer;

    INSERT IGNORE INTO _sm_keep (id, transformer_id, rn)
    SELECT a.id, a.transformer_id, 999
      FROM alerts a
      JOIN alert_cases c ON c.alert_id = a.id
     WHERE c.status IN ('ACKNOWLEDGED', 'DISPATCHED');

    -- 2. per-transformer totals so the newest kept alert can absorb the deleted rows
    DROP TABLE IF EXISTS _sm_counts;
    CREATE TABLE _sm_counts (
        transformer_key BIGINT NOT NULL PRIMARY KEY,
        total BIGINT NOT NULL,
        kept BIGINT NOT NULL DEFAULT 0
    ) ENGINE = InnoDB;
    INSERT INTO _sm_counts (transformer_key, total)
    SELECT COALESCE(transformer_id, -1), COUNT(*) FROM alerts GROUP BY COALESCE(transformer_id, -1);
    UPDATE _sm_counts sc
      JOIN (SELECT COALESCE(transformer_id, -1) AS tk, COUNT(*) AS kept FROM _sm_keep GROUP BY COALESCE(transformer_id, -1)) k
        ON k.tk = sc.transformer_key
       SET sc.kept = k.kept;

    -- 3. new alerts table with only the kept rows
    DROP TABLE IF EXISTS alerts_new;
    CREATE TABLE alerts_new LIKE alerts;
    IF had_columns THEN
        INSERT INTO alerts_new SELECT a.* FROM alerts a JOIN _sm_keep k ON k.id = a.id;
    ELSE
        CALL _sm_add_alert_columns('alerts_new');
        -- new columns are appended last, so a.* + 3 values lines up positionally
        INSERT INTO alerts_new SELECT a.*, 1, a.created_at, a.created_at FROM alerts a JOIN _sm_keep k ON k.id = a.id;
    END IF;

    UPDATE alerts_new n
      JOIN _sm_keep k ON k.id = n.id AND k.rn = 1
      JOIN _sm_counts sc ON sc.transformer_key = COALESCE(k.transformer_id, -1)
       SET n.occurrence_count = GREATEST(1, sc.total - sc.kept + 1),
           n.last_seen_at = COALESCE(n.last_seen_at, n.created_at);

    SELECT COALESCE(MAX(id), 0) + 1 INTO @next_alert_id FROM alerts;
    CALL _sm_exec(CONCAT('ALTER TABLE alerts_new AUTO_INCREMENT = ', @next_alert_id));

    -- 4. cases of the kept alerts
    DROP TABLE IF EXISTS alert_cases_new;
    CREATE TABLE alert_cases_new LIKE alert_cases;
    INSERT INTO alert_cases_new SELECT c.* FROM alert_cases c JOIN _sm_keep k ON k.id = c.alert_id;
    SELECT COALESCE(MAX(id), 0) + 1 INTO @next_case_id FROM alert_cases;
    CALL _sm_exec(CONCAT('ALTER TABLE alert_cases_new AUTO_INCREMENT = ', @next_case_id));

    -- 5. activities of the kept cases
    DROP TABLE IF EXISTS alert_case_activities_new;
    CREATE TABLE alert_case_activities_new LIKE alert_case_activities;
    INSERT INTO alert_case_activities_new
    SELECT act.* FROM alert_case_activities act JOIN alert_cases_new c ON c.id = act.alert_case_id;
    SELECT COALESCE(MAX(id), 0) + 1 INTO @next_activity_id FROM alert_case_activities;
    CALL _sm_exec(CONCAT('ALTER TABLE alert_case_activities_new AUTO_INCREMENT = ', @next_activity_id));

    -- 6. auto-close older duplicate open cases (same transformer + device), keep the newest open
    IF @auto_close_duplicates = 1 THEN
        DROP TABLE IF EXISTS _sm_close;
        CREATE TABLE _sm_close (case_id BIGINT NOT NULL PRIMARY KEY, prev_status VARCHAR(32)) ENGINE = InnoDB;
        INSERT INTO _sm_close (case_id, prev_status)
        SELECT case_id, status FROM (
            SELECT c.id AS case_id, c.status,
                   ROW_NUMBER() OVER (PARTITION BY a.transformer_id, a.device_id, a.sensor_id, a.sensor_type
                                      ORDER BY a.id DESC) AS rn
              FROM alerts_new a
              JOIN alert_cases_new c ON c.alert_id = a.id
             WHERE c.status = 'NEW' AND a.transformer_id IS NOT NULL
        ) x
        WHERE x.rn > 1;

        UPDATE alert_cases_new c
          JOIN _sm_close z ON z.case_id = c.id
           SET c.status = 'RESOLVED',
               c.resolved_at = NOW(6),
               c.last_action_at = NOW(6),
               c.last_action_by_email = 'system',
               c.last_action_by_name = 'Alert consolidation',
               c.last_action_note = 'Auto-closed: duplicate of a newer open alert on the same device (alert consolidation 2026-10-15)';

        INSERT INTO alert_case_activities_new
            (alert_case_id, activity_type, status_before, status_after, actor_email, actor_name, note, created_at)
        SELECT z.case_id, 'STATUS_CHANGED', z.prev_status, 'RESOLVED', 'system', 'Alert consolidation',
               'Auto-closed: duplicate of a newer open alert on the same device', NOW(6)
          FROM _sm_close z;
        SELECT ROW_COUNT() INTO @closed_duplicates;
        DROP TABLE _sm_close;
    END IF;

    -- 7. atomic swap; old tables kept as backups
    RENAME TABLE alerts                TO alerts_bak_20261015,
                 alerts_new            TO alerts,
                 alert_cases           TO alert_cases_bak_20261015,
                 alert_cases_new       TO alert_cases,
                 alert_case_activities TO alert_case_activities_bak_20261015,
                 alert_case_activities_new TO alert_case_activities;

    SELECT @alerts_before AS alerts_before,
           (SELECT COUNT(*) FROM alerts) AS alerts_after,
           (SELECT COUNT(*) FROM alert_cases) AS cases_after,
           (SELECT COUNT(*) FROM alert_case_activities) AS activities_after,
           COALESCE(@closed_duplicates, 0) AS duplicate_cases_auto_closed;

    DROP TABLE _sm_keep;
    DROP TABLE _sm_counts;
END $$

-- ----------------------------------------------------------------------------
-- PART 2: idempotent schema
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS _sm_alert_schema $$
CREATE PROCEDURE _sm_alert_schema()
BEGIN
    CALL _sm_add_alert_columns('alerts');

    -- alerts: every list / lookup path is "filter, ORDER BY id DESC"
    IF NOT _sm_index_exists('alerts', 'idx_alerts_transformer_id') THEN
        CALL _sm_exec('CREATE INDEX idx_alerts_transformer_id ON alerts (transformer_id, id)');
    END IF;
    IF NOT _sm_index_exists('alerts', 'idx_alerts_supplier_id') THEN
        CALL _sm_exec('CREATE INDEX idx_alerts_supplier_id ON alerts (supplier_code, id)');
    END IF;
    IF NOT _sm_index_exists('alerts', 'idx_alerts_depot_id') THEN
        CALL _sm_exec('CREATE INDEX idx_alerts_depot_id ON alerts (depot_id, id)');
    END IF;
    IF NOT _sm_index_exists('alerts', 'idx_alerts_sensor_id') THEN
        CALL _sm_exec('CREATE INDEX idx_alerts_sensor_id ON alerts (sensor_id, id)');
    END IF;
    IF NOT _sm_index_exists('alerts', 'idx_alerts_created_at') THEN
        CALL _sm_exec('CREATE INDEX idx_alerts_created_at ON alerts (created_at)');
    END IF;

    -- alert_cases: alert_id lookups + status filters
    IF NOT _sm_index_exists('alert_cases', 'idx_alert_cases_alert_id')
       AND NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS
                        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'alert_cases'
                          AND COLUMN_NAME = 'alert_id' AND SEQ_IN_INDEX = 1) THEN
        CALL _sm_exec('CREATE INDEX idx_alert_cases_alert_id ON alert_cases (alert_id)');
    END IF;
    IF NOT _sm_index_exists('alert_cases', 'idx_alert_cases_status') THEN
        CALL _sm_exec('CREATE INDEX idx_alert_cases_status ON alert_cases (status, alert_id)');
    END IF;

    -- alert_case_activities: timeline lookup
    IF NOT _sm_index_exists('alert_case_activities', 'idx_aca_case_created') THEN
        CALL _sm_exec('CREATE INDEX idx_aca_case_created ON alert_case_activities (alert_case_id, created_at)');
    END IF;

    -- per-transformer snapshot read by dashboard / map / regions
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
    ) ENGINE = InnoDB;
END $$

DELIMITER ;

CALL _sm_consolidate_alerts();
CALL _sm_alert_schema();

-- tidy up helper routines
DROP PROCEDURE IF EXISTS _sm_consolidate_alerts;
DROP PROCEDURE IF EXISTS _sm_alert_schema;
DROP PROCEDURE IF EXISTS _sm_add_alert_columns;
DROP PROCEDURE IF EXISTS _sm_exec;
DROP FUNCTION IF EXISTS _sm_column_exists;
DROP FUNCTION IF EXISTS _sm_index_exists;
DROP FUNCTION IF EXISTS _sm_table_exists;

-- The transformer_alert_state rows are filled by transformer-service on startup
-- (AlertStateService#rebuildOnStartup) or via POST /api/v1/alerts/transformers/rebuild.

-- Verification
SELECT COUNT(*) AS alerts_now FROM alerts;
SELECT transformer_id, COUNT(*) AS kept, SUM(occurrence_count) AS events
  FROM alerts GROUP BY transformer_id ORDER BY events DESC LIMIT 10;
