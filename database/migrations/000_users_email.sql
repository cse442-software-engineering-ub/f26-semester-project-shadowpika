-- Compatibility upgrade for the original users table, which only had
-- id, username, password_hash, and created_at. Existing accounts are preserved and
-- keep a NULL email; they can still sign in with their username. New registrations
-- populate email through register.php.
--
-- Safe to re-run. Run before 001_admin_requests.sql.

SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email'
);
SET @migration_sql = IF(
    @column_exists = 0,
    'ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL AFTER username',
    'SELECT 1'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;
