-- Recently viewed items used by api/record_viewed_item.php and api/get_previously_viewed_items.php
-- (card #216). Safe to re-run: the table is only created if missing.
--
-- user_id copies the exact column type of users.id so the foreign key always matches it.
-- PRIMARY KEY (user_id, listing_id) keeps one row per user and item; viewed_at (microseconds) orders the list.
SET @users_id_type = (
    SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'
);
SET @migration_sql = CONCAT(
    'CREATE TABLE IF NOT EXISTS recently_viewed (
        user_id    ', @users_id_type, ' NOT NULL,
        listing_id INT          NOT NULL,
        viewed_at  DATETIME(6)  NOT NULL,
        PRIMARY KEY (user_id, listing_id),
        KEY idx_recently_viewed_user_viewed (user_id, viewed_at),
        CONSTRAINT fk_recently_viewed_user
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_recently_viewed_listing
            FOREIGN KEY (listing_id) REFERENCES listings (listing_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;
