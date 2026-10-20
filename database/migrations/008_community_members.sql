-- Community shopping: users can join several communities and choose which ones to shop from.
-- Run once after 003 and 006. Safe to re-run: the table is only created if missing, and the
-- copy below skips memberships that already exist.
--
-- community_id is the community's listed id (its partner's admin_requests.id, see 003).
-- shopping = 1 means the community's listings appear in the user's search results.
-- Everyone is automatically in "All of UB", so a row for it only records shopping = 0.
-- users.community_id (003) is no longer read; it is left in place so nothing deployed breaks.
--
-- user_id copies the exact column type of users.id so the foreign key always matches it.
SET @users_id_type = (
    SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'
);
SET @migration_sql = CONCAT(
    'CREATE TABLE IF NOT EXISTS community_members (
        user_id      ', @users_id_type, ' NOT NULL,
        community_id INT UNSIGNED NOT NULL,
        shopping     TINYINT(1)   NOT NULL DEFAULT 1,
        joined_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, community_id),
        KEY idx_community_members_community (community_id),
        CONSTRAINT fk_community_members_user
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_community_members_community
            FOREIGN KEY (community_id) REFERENCES admin_requests (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

-- Keep the community each user had already joined under the one-community design.
INSERT IGNORE INTO community_members (user_id, community_id, shopping)
SELECT id, community_id, 1 FROM users WHERE community_id IS NOT NULL;
