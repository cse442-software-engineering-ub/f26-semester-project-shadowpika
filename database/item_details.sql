-- Test data for the item details task cards (#151 frontend, #152 backend).
-- Run after database/listings.sql. It adds no listings; it only resets descriptions on the
-- existing search books. Safe to re-run.

-- Older databases created by listings.sql alone have no description column yet.
SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listings' AND COLUMN_NAME = 'description'
);
SET @migration_sql = IF(
    @column_exists = 0,
    'ALTER TABLE listings ADD COLUMN description TEXT NULL',
    'SELECT 1'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

-- 91001 Calculus Textbook has a description; 91002 Calculus Workbook has none.
UPDATE listings SET description = 'Used for one semester. No writing or highlighting.' WHERE listing_id = 91001;
UPDATE listings SET description = NULL WHERE listing_id = 91002;
