-- #132/#133: seller ratings. Run after 015 in the application database.
-- Additive and re-runnable: the table is only created when missing, so an existing ratings
-- table from the first prototype keeps its rows. User ids copy the users.id type so the
-- foreign keys work with legacy tables. Times are stored in UTC by the application.
SET @users_id_type = (
    SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'
);

SET @ratings_sql = CONCAT(
    'CREATE TABLE IF NOT EXISTS ratings (
        rating_id   INT UNSIGNED     NOT NULL AUTO_INCREMENT PRIMARY KEY,
        reviewer_id ', @users_id_type, ' NOT NULL,
        seller_id   ', @users_id_type, ' NOT NULL,
        stars       TINYINT UNSIGNED NOT NULL,
        review      TEXT             NULL,
        `time`      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_ratings_reviewer_seller (reviewer_id, seller_id),
        KEY idx_ratings_seller (seller_id),
        CONSTRAINT fk_ratings_reviewer FOREIGN KEY (reviewer_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_ratings_seller FOREIGN KEY (seller_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
);
PREPARE ratings_statement FROM @ratings_sql;
EXECUTE ratings_statement;
DEALLOCATE PREPARE ratings_statement;
