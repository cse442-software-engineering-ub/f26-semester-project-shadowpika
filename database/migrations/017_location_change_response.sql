-- #219: apply after 014, in the verified application database after backup.
-- Additive and re-runnable. Saves the location the buyer picked before the seller suggested a new one, and
-- whether the buyer accepted or denied the new location (the seller sees it until they dismiss it).
-- Existing requests keep NULL in all three columns.
SET @original_location_id_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meeting_requests' AND COLUMN_NAME = 'original_location_id'
);
SET @location_change_sql = IF(@original_location_id_exists = 0,
    'ALTER TABLE meeting_requests ADD COLUMN original_location_id INT UNSIGNED NULL DEFAULT NULL', 'SELECT 1');
PREPARE location_change_statement FROM @location_change_sql;
EXECUTE location_change_statement;
DEALLOCATE PREPARE location_change_statement;

SET @original_location_label_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meeting_requests' AND COLUMN_NAME = 'original_location_label'
);
SET @location_change_sql = IF(@original_location_label_exists = 0,
    'ALTER TABLE meeting_requests ADD COLUMN original_location_label VARCHAR(100) NULL DEFAULT NULL', 'SELECT 1');
PREPARE location_change_statement FROM @location_change_sql;
EXECUTE location_change_statement;
DEALLOCATE PREPARE location_change_statement;

SET @location_change_result_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meeting_requests' AND COLUMN_NAME = 'location_change_result'
);
SET @location_change_sql = IF(@location_change_result_exists = 0,
    'ALTER TABLE meeting_requests ADD COLUMN location_change_result ENUM(''accepted'', ''denied'') NULL DEFAULT NULL', 'SELECT 1');
PREPARE location_change_statement FROM @location_change_sql;
EXECUTE location_change_statement;
DEALLOCATE PREPARE location_change_statement;
