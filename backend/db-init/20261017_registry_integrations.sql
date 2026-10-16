-- ============================================================================
-- TRANSFORMER REGISTRY + SUPPLIER INTEGRATIONS             (database: tms, MySQL 8)
-- ============================================================================
-- Adds the supplier_integrations table (one row per partner telemetry feed) and the
-- controller indexes the registry and "unmatched controllers" queue rely on.
-- Idempotent and additive. Run before starting the new transformer-service build:
--   mysql -h 192.168.15.228 -u root -p tms < backend/db-init/20261017_registry_integrations.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplier_integrations (
    id                      BIGINT        NOT NULL AUTO_INCREMENT,
    supplier_code           VARCHAR(64)   NOT NULL,
    supplier_name           VARCHAR(255)  NULL,
    name                    VARCHAR(255)  NOT NULL,
    transport               VARCHAR(32)   NOT NULL,
    endpoint_url            VARCHAR(1000) NULL,
    push_secret             VARCHAR(128)  NULL,
    decoder_key             VARCHAR(64)   NOT NULL,
    default_controller_type VARCHAR(64)   NULL,
    auto_register           BIT(1)        NOT NULL DEFAULT b'1',
    enabled                 BIT(1)        NOT NULL DEFAULT b'1',
    status                  VARCHAR(32)   NULL,
    last_error              VARCHAR(1000) NULL,
    last_connected_at       DATETIME(6)   NULL,
    last_message_at         DATETIME(6)   NULL,
    messages_received       BIGINT        NOT NULL DEFAULT 0,
    devices_registered      BIGINT        NOT NULL DEFAULT 0,
    created_at              DATETIME(6)   NULL,
    updated_at              DATETIME(6)   NULL,
    PRIMARY KEY (id),
    KEY idx_si_supplier (supplier_code),
    KEY idx_si_enabled (enabled, transport)
) ENGINE = InnoDB;

-- Placeholder for the existing Oculus feed: disabled, no URL. To move Oculus onto the
-- framework, paste the LORIOT app websocket URL on the Integrations screen, enable it,
-- and clear OCULUS_WS_URL (the legacy ingestor) so messages are not ingested twice.
INSERT INTO supplier_integrations (supplier_code, supplier_name, name, transport, decoder_key,
                                   default_controller_type, auto_register, enabled, status, created_at, updated_at)
SELECT 'oculus', 'Oculus', 'Oculus LORIOT application', 'LORIOT_WEBSOCKET', 'dragino-lt22222',
       'DRAGINO_LT22222', b'1', b'0', 'STOPPED', NOW(6), NOW(6)
  FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM supplier_integrations WHERE supplier_code = 'oculus');

DELIMITER $$
DROP PROCEDURE IF EXISTS _ri_idx $$
CREATE PROCEDURE _ri_idx(IN tbl VARCHAR(64), IN idx VARCHAR(64), IN cols VARCHAR(255))
BEGIN
    IF (SELECT COUNT(*) FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND INDEX_NAME = idx) = 0 THEN
        SET @_ri_sql = CONCAT('CREATE INDEX ', idx, ' ON `', tbl, '` (', cols, ')');
        PREPARE _ri_ps FROM @_ri_sql;
        EXECUTE _ri_ps;
        DEALLOCATE PREPARE _ri_ps;
    END IF;
END $$
DELIMITER ;

CALL _ri_idx('controllers', 'idx_controllers_transformer', 'transformer_id');
CALL _ri_idx('controllers', 'idx_controllers_dev_eui', 'dev_eui');
CALL _ri_idx('controllers', 'idx_controllers_supplier_tx', 'supplier_code, transformer_id');
CALL _ri_idx('transformers', 'idx_transformers_depot', 'depot_id');
CALL _ri_idx('transformers', 'idx_transformers_supplier', 'supplier_code');
DROP PROCEDURE IF EXISTS _ri_idx;

SELECT 'registry + integrations schema ready' AS info,
       (SELECT COUNT(*) FROM supplier_integrations) AS integrations,
       (SELECT COUNT(*) FROM controllers WHERE transformer_id IS NULL) AS unmatched_controllers;
