-- Run once against cse442_2026_fall_team_j_db (e.g. in phpMyAdmin's SQL tab).
-- Pins marking safe on-campus meetup spots, managed by admins in Settings -> Admin.
--
-- created_by copies the exact column type of users.id so the foreign key always matches it.
-- If the admin who added a pin is deleted, the pin stays and created_by becomes NULL.

SET @users_id_type = (
    SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'
);
SET @migration_sql = CONCAT(
    'CREATE TABLE approved_locations (
        id         INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
        lat        DECIMAL(9,6)  NOT NULL,
        lng        DECIMAL(9,6)  NOT NULL,
        label      VARCHAR(100)  NOT NULL,
        created_by ', @users_id_type, ' NULL,
        created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_approved_locations_created_by
            FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;
