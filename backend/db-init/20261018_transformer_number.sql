-- Rename transformer "capacity" to "transformer number" (utility plate number, text).
-- transformer-service applies the same change automatically on start-up (SchemaUpgrader);
-- run this by hand only if that is switched off (schema.auto-upgrade=false).
-- Safe to run more than once. Existing values are kept as text.

DROP PROCEDURE IF EXISTS tms_rename_column;
DELIMITER //
CREATE PROCEDURE tms_rename_column(IN t VARCHAR(64), IN old_col VARCHAR(64), IN new_col VARCHAR(64), IN ddl VARCHAR(255))
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = t AND COLUMN_NAME = old_col)
     AND NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = t AND COLUMN_NAME = new_col) THEN
    SET @s = CONCAT('ALTER TABLE `', t, '` CHANGE COLUMN `', old_col, '` `', new_col, '` ', ddl);
    PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
  END IF;
END //
DELIMITER ;

CALL tms_rename_column('transformers', 'capacity', 'transformer_number', 'VARCHAR(64) NULL');
CALL tms_rename_column('alerts', 'transformer_capacity', 'transformer_number', 'VARCHAR(64) NULL');
DROP PROCEDURE IF EXISTS tms_rename_column;
