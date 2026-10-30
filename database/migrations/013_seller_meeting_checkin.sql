-- #206: apply after 012, in the verified application database after backup.
-- Additive and re-runnable. Preserve all buyer timestamps and existing meetings.
-- Never infer the seller's arrival from a buyer check-in.
SET @seller_checkin_column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meeting_requests'
      AND COLUMN_NAME = 'seller_checked_in_at'
);
SET @seller_checkin_migration_sql = IF(@seller_checkin_column_exists = 0,
    'ALTER TABLE meeting_requests ADD COLUMN seller_checked_in_at DATETIME(6) NULL DEFAULT NULL', 'SELECT 1');
PREPARE seller_checkin_migration_statement FROM @seller_checkin_migration_sql;
EXECUTE seller_checkin_migration_statement;
DEALLOCATE PREPARE seller_checkin_migration_statement;
