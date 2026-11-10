-- Messaging (#12/#13) QA fixture. Run after migrations/015_messages.sql.
-- Uses the existing account morgan.keller1@test.com as the seller. The listing is in the campus
-- community, so every logged-in student can see it and message the seller. Safe to re-run.

SET @morgan = (SELECT id FROM users WHERE email = 'morgan.keller1@test.com');

INSERT INTO listings (listing_id, owner_id, name, price, `condition`, image_url, category, community, meeting_location, description, status)
VALUES (95030, @morgan, 'Messaging Test Desk Lamp', 15.00, 'Good', NULL, 'Dorm Living', 'Karavan', 'Capen Hall', 'Messaging and rating test item', 'active')
ON DUPLICATE KEY UPDATE owner_id = VALUES(owner_id), name = VALUES(name), community = VALUES(community), status = VALUES(status);

-- Check: one active listing owned by morgan.keller1
SELECT listing_id, name, owner_id, community, status FROM listings WHERE listing_id = 95030;

-- Teardown:
-- DELETE FROM messages WHERE listing_id = 95030;
-- DELETE FROM listings WHERE listing_id = 95030 AND description = 'Messaging and rating test item';
