-- ============================================================================
-- PHASE 2 — INDUSTRY STANDARD DENORMALIZATION
-- Purpose: Eliminate million-row scans of controller_readings / controller_commands
--          fact tables during dashboard list-page loads.
-- Rollout Order (NON-NEGOTIABLE FOR ZERO DOWNTIME):
--   1. STOP transformer-service container on live FIRST
--   2. RUN this SQL file against tms database (columns + backfill)
--   3. VERIFY backfill row counts > 0
--   4. DEPLOY Phase2 jar (code that reads denorm columns)
--   5. START transformer-service container
--   ddl-auto must remain =none  (in transformer-service.properties)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Step A: ADD DENORMALIZED READING + COMMAND SUMMARY COLUMNS TO controllers TABLE
-- ----------------------------------------------------------------------------
ALTER TABLE controllers
    ADD COLUMN IF NOT EXISTS last_reading_at               DATETIME(3)            NULL COMMENT 'Timestamp of latest controller_reading row (denorm, auto-updated on reading save)',
    ADD COLUMN IF NOT EXISTS last_reading_di1            TINYINT(1)             NULL COMMENT 'Latest motion contact (denorm)',
    ADD COLUMN IF NOT EXISTS last_reading_di2            TINYINT(1)             NULL COMMENT 'Latest secondary contact (denorm)',
    ADD COLUMN IF NOT EXISTS last_reading_battery        INT                    NULL COMMENT 'Latest battery % (denorm)',
    ADD COLUMN IF NOT EXISTS last_reading_rssi           INT                    NULL COMMENT 'Latest RSSI dBm (denorm)',
    ADD COLUMN IF NOT EXISTS last_reading_snr            INT                    NULL COMMENT 'Latest SNR dB (denorm)',
    ADD COLUMN IF NOT EXISTS last_reading_decoded_payload  TEXT                   NULL COMMENT 'Latest decoded payload JSON (RO1/RO1 arm state extraction)',
    ADD COLUMN IF NOT EXISTS last_command_at             DATETIME(3)            NULL COMMENT 'Timestamp of latest controller_command (denorm)',
    ADD COLUMN IF NOT EXISTS last_command_action        VARCHAR(50)            NULL COMMENT 'Latest command: ARM/DISARM (enum)',
    ADD COLUMN IF NOT EXISTS last_command_status        VARCHAR(50)            NULL COMMENT 'Latest: PENDING/SENT/FAILED (enum)',
    ADD COLUMN IF NOT EXISTS last_command_requested_by  VARCHAR(255)           NULL COMMENT 'Latest requester email (denorm)';

-- ----------------------------------------------------------------------------
-- Step B: ADD TELEMETRY + COMMAND SUMMARY COLUMNS TO transformers TABLE
-- ----------------------------------------------------------------------------
ALTER TABLE transformers
    ADD COLUMN IF NOT EXISTS last_telemetry_at         DATETIME(3)            NULL COMMENT 'Max of all linked controllers last_reading_at',
    ADD COLUMN IF NOT EXISTS last_command_at            DATETIME(3)            NULL COMMENT 'Max of all linked controllers last_command_at';

-- ----------------------------------------------------------------------------
-- Step C: 1-TIME BACKFILL — Populate controllers.*  FROM EXISTING FACT ROWS
--         Uses correlated UPDATE ... JOIN  (safe, no subqueries; N indexes)
-- ----------------------------------------------------------------------------

-- C1: Backfill last_reading_* on controllers
UPDATE controllers c
INNER JOIN (
    SELECT
        cr.controller_id,
        cr.created_at,
        cr.di1,
        cr.di2,
        cr.battery,
        cr.rssi,
        cr.snr,
        cr.decoded_payload
    FROM controller_readings cr
    INNER JOIN (
        SELECT controller_id, MAX(id) AS max_id
        FROM controller_readings
        GROUP BY controller_id
    ) latest ON latest.controller_id = cr.controller_id AND cr.id = latest.max_id
) lr ON lr.controller_id = c.id
SET
    c.last_reading_at               = lr.created_at,
    c.last_reading_di1              = lr.di1,
    c.last_reading_di2              = lr.di2,
    c.last_reading_battery          = lr.battery,
    c.last_reading_rssi             = lr.rssi,
    c.last_reading_snr              = lr.snr,
    c.last_reading_decoded_payload  = lr.decoded_payload
WHERE c.last_reading_at IS NULL;  -- skip if already populated

-- C2: Backfill last_command_* on controllers
UPDATE controllers c
INNER JOIN (
    SELECT
        cc.controller_id,
        cc.created_at,
        cc.command_action,
        cc.command_status,
        cc.requested_by_email
    FROM controller_commands cc
    INNER JOIN (
        SELECT controller_id, MAX(id) AS max_id
        FROM controller_commands
        GROUP BY controller_id
    ) latest ON latest.controller_id = cc.controller_id AND cc.id = latest.max_id
) lc ON lc.controller_id = c.id
SET
    c.last_command_at             = lc.created_at,
    c.last_command_action        = lc.command_action,
    c.last_command_status        = lc.command_status,
    c.last_command_requested_by  = lc.requested_by_email
WHERE c.last_command_at IS NULL;

-- C3: Backfill transformers.last_telemetry_at = MAX(controllers.last_reading_at)
UPDATE transformers t
INNER JOIN (
    SELECT transformer_id, MAX(last_reading_at) AS max_reading_at
    FROM controllers
    WHERE transformer_id IS NOT NULL AND last_reading_at IS NOT NULL
    GROUP BY transformer_id
) cagg ON cagg.transformer_id = t.id
SET t.last_telemetry_at = cagg.max_reading_at
WHERE t.last_telemetry_at IS NULL;

-- C4: Backfill transformers.last_command_at = MAX(controllers.last_command_at)
UPDATE transformers t
INNER JOIN (
    SELECT transformer_id, MAX(last_command_at) AS max_cmd_at
    FROM controllers
    WHERE transformer_id IS NOT NULL AND last_command_at IS NOT NULL
    GROUP BY transformer_id
) cagg ON cagg.transformer_id = t.id
SET t.last_command_at = cagg.max_cmd_at
WHERE t.last_command_at IS NULL;

-- ----------------------------------------------------------------------------
-- Step D: VERIFY (run after backfill — expected >0 for production)
-- ----------------------------------------------------------------------------
-- SELECT COUNT(*) AS backfilled_controllers_with_reading FROM controllers WHERE last_reading_at IS NOT NULL;
-- SELECT COUNT(*) AS backfilled_controllers_with_cmd     FROM controllers WHERE last_command_at IS NOT NULL;
-- SELECT COUNT(*) AS backfilled_transformers_with_telemetry FROM transformers WHERE last_telemetry_at IS NOT NULL;
-- SELECT COUNT(*) AS backfilled_transformers_with_cmd   FROM transformers WHERE last_command_at IS NOT NULL;
