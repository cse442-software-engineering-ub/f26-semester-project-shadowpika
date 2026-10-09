-- Meeting requests table plus the test data for the meeting request task cards (#167 backend,
-- #168 frontend). Run after database/listings.sql. Safe to re-run: the table is only created if
-- missing, the seed locations are upserted, and chun.buyer@test.com's requests are reset.
--
-- Needs listings.owner_id (added by listing/database/001_create_listing.sql) and the
-- approved_locations table (sql/002_approved_locations.sql).

-- buyer_id copies the exact column type of users.id so the foreign key always matches it.
-- location_label keeps the label the buyer chose even if an admin later removes the location.
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

-- The three approved meeting locations the tests use.
INSERT INTO approved_locations (id, lat, lng, label) VALUES
    (91001, 43.000822, -78.789203, 'Capen Hall Main Entrance'),
    (91002, 43.001054, -78.786087, 'Student Union Main Entrance'),
    (91003, 43.000216, -78.785872, 'Lockwood Memorial Library Main Entrance')
ON DUPLICATE KEY UPDATE lat = VALUES(lat), lng = VALUES(lng), label = VALUES(label);

SET @buyer_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('chun.buyer@test.com') LIMIT 1);

-- chun.buyer@test.com owns 91010 Dorm Fridge, so it cannot be requested and shows no Buy Now.
UPDATE listings SET owner_id = @buyer_id WHERE listing_id = 91010;

-- Reset chun.buyer@test.com's requests to the three the tests expect, in this order.
DELETE FROM meeting_requests WHERE buyer_id = @buyer_id;
INSERT INTO meeting_requests (buyer_id, listing_id, meeting_date, meeting_time, location_id, location_label, status) VALUES
    (@buyer_id, 91001, '2026-12-08', '14:30:00', 91001, 'Capen Hall Main Entrance',                'approved'),
    (@buyer_id, 91007, '2026-12-09', '17:00:00', 91002, 'Student Union Main Entrance',             'location_change_requested'),
    (@buyer_id, 91003, '2026-12-10', '15:00:00', 91003, 'Lockwood Memorial Library Main Entrance', 'denied');
