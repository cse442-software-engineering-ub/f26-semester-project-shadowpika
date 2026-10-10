-- Production schema for buyer meeting requests. This file intentionally contains no
-- task-card users, locations, or requests. Run after 002_approved_locations.sql and
-- schema/listings.sql.
--
-- buyer_id copies the exact users.id type so the foreign key works with legacy tables.
-- Safe to re-run: the table is only created when missing.

SET @users_id_type = (
    SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'
);
SET @migration_sql = CONCAT(
    'CREATE TABLE IF NOT EXISTS meeting_requests (
        request_id     INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
        buyer_id       ', @users_id_type, ' NOT NULL,
        listing_id     INT           NOT NULL,
        meeting_date   DATE          NOT NULL,
        meeting_time   TIME          NOT NULL,
        location_id    INT UNSIGNED  NULL,
        location_label VARCHAR(100)  NOT NULL,
        status         ENUM(''pending'', ''approved'', ''denied'', ''location_change_requested'') NOT NULL DEFAULT ''pending'',
        created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_meeting_requests_buyer (buyer_id),
        KEY idx_meeting_requests_listing (listing_id),
        CONSTRAINT fk_meeting_requests_buyer
            FOREIGN KEY (buyer_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_meeting_requests_listing
            FOREIGN KEY (listing_id) REFERENCES listings (listing_id) ON DELETE CASCADE,
        CONSTRAINT fk_meeting_requests_location
            FOREIGN KEY (location_id) REFERENCES approved_locations (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;
