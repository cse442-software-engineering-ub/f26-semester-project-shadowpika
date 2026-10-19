-- Favorites table used by api/save_favorite.php, api/get_favorites.php, and api/get_favorite_status.php
-- (card #118). Run after database/seeds/listings.sql. Safe to re-run: the table is only created if missing.
--
-- user_id copies the exact column type of users.id so the foreign key always matches it.
-- UNIQUE (user_id, listing_id) means an item is saved once per user; created_at orders the list.
SET @users_id_type = (
    SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'
);
SET @migration_sql = CONCAT(
    'CREATE TABLE IF NOT EXISTS favorites (
        favorite_id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id     ', @users_id_type, ' NOT NULL,
        listing_id  INT          NOT NULL,
        created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_favorites_user_listing (user_id, listing_id),
        KEY idx_favorites_listing (listing_id),
        CONSTRAINT fk_favorites_user
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_favorites_listing
            FOREIGN KEY (listing_id) REFERENCES listings (listing_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;
