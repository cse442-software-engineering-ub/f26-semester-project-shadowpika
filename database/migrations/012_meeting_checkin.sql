-- #206: run in the verified application database after backing it up.
-- Additive and re-runnable. No fixtures, backfills, deletes, or state resets.
-- checked_in_at is the first successful server timestamp, stored in UTC.
SET @checkin_column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meeting_requests' AND COLUMN_NAME = 'checked_in_at'
);
SET @checkin_migration_sql = IF(@checkin_column_exists = 0,
    'ALTER TABLE meeting_requests ADD COLUMN checked_in_at DATETIME(6) NULL DEFAULT NULL', 'SELECT 1');
PREPARE checkin_migration_statement FROM @checkin_migration_sql;
EXECUTE checkin_migration_statement;
DEALLOCATE PREPARE checkin_migration_statement;
