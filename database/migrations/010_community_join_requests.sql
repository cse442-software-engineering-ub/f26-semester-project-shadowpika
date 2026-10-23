-- Shoppers request to join a community; the community's admin approves or denies.
-- A row here means the request is pending. Approval writes community_members and deletes this row.
-- Denial only deletes this row, so the shopper can request again.
-- Run after 008_community_members.sql. Safe to re-run.

SET @users_id_type = (
    SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'
);
SET @migration_sql = CONCAT(
    'CREATE TABLE IF NOT EXISTS community_join_requests (
        user_id      ', @users_id_type, ' NOT NULL,
        community_id INT UNSIGNED NOT NULL,
        created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, community_id),
        KEY idx_join_requests_community (community_id),
        CONSTRAINT fk_join_requests_user
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_join_requests_community
            FOREIGN KEY (community_id) REFERENCES admin_requests (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;
