-- Seller rating (#132/#133) QA fixture. Run after migrations/016_ratings.sql and seeds/messages_test.sql.
-- Uses the existing accounts morgan.keller1@test.com (seller) and riley.shopper1@test.com (buyer).
-- 95031 was already sold to riley.shopper1 at a meeting where both checked in, which is the
-- completed purchase that lets riley.shopper1 rate morgan.keller1. Safe to re-run.

SET @morgan = (SELECT id FROM users WHERE email = 'morgan.keller1@test.com');
SET @riley = (SELECT id FROM users WHERE email = 'riley.shopper1@test.com');

INSERT INTO listings (listing_id, owner_id, name, price, `condition`, image_url, category, community, meeting_location, description, status)
VALUES (95031, @morgan, 'Rating Test Bluetooth Speaker', 25.00, 'Like New', NULL, 'Tech & Electronics', 'Karavan', 'Capen Hall', 'Messaging and rating test item', 'sold')
ON DUPLICATE KEY UPDATE owner_id = VALUES(owner_id), name = VALUES(name), community = VALUES(community), status = VALUES(status);

DELETE FROM meeting_requests WHERE listing_id = 95031;
INSERT INTO meeting_requests (buyer_id, listing_id, meeting_date, meeting_time, location_id, location_label, status, checked_in_at, seller_checked_in_at)
VALUES (@riley, 95031, '2026-11-02', '12:00:00', NULL, 'Capen Hall', 'approved', '2026-11-02 17:00:00', '2026-11-02 17:01:00');

-- Check: one sold listing owned by morgan.keller1 and one approved, both-checked-in meeting for riley.shopper1
SELECT listing_id, name, owner_id, community, status FROM listings WHERE listing_id = 95031;
SELECT request_id, buyer_id, listing_id, status, checked_in_at, seller_checked_in_at FROM meeting_requests WHERE listing_id = 95031;

-- Teardown:
-- DELETE FROM ratings WHERE seller_id = (SELECT id FROM users WHERE email = 'morgan.keller1@test.com');
-- DELETE FROM listings WHERE listing_id = 95031 AND description = 'Messaging and rating test item';
