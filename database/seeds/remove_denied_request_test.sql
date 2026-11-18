-- Remove denied request QA fixture (card #237): listings 92141-92148 and purchase requests 92141-92149
-- (david.buyer@test.com and david.seller@test.com are the requesters; 92147 is owned by david.buyer@test.com).
-- Run after database/seeds/listings.sql and database/migrations/meeting_requests.sql; david.buyer@test.com and david.seller@test.com must already be registered.
-- Safe to re-run: removes only its own listings (ids 92141-92148 with the marker description; their requests go with
-- them) and adds everything fresh. If an id 92141-92150 is already used by another row, the checks below show it instead of overwriting it.
-- Undo with database/seeds/remove_denied_request_teardown.sql.

SET @buyer_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('david.buyer@test.com') LIMIT 1);
SET @seller_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('david.seller@test.com') LIMIT 1);

-- The marker is written out here: comparing the column with a variable fails on the team DB (#1267, mixed collations).
DELETE FROM listings WHERE listing_id BETWEEN 92141 AND 92150 AND description = 'Remove denied request test item';

INSERT IGNORE INTO listings (listing_id, name, price, `condition`, image_url, category, related_course, community, status, owner_id, description)
VALUES
    (92141, 'Remove Denied Item 1', 41.00, 'Good', NULL, 'Other', NULL, 'Karavan', 'active',   @seller_id, 'Remove denied request test item'),
    (92142, 'Remove Denied Item 2', 42.00, 'Good', NULL, 'Other', NULL, 'Karavan', 'active',   @seller_id, 'Remove denied request test item'),
    (92143, 'Remove Denied Item 3', 43.00, 'Good', NULL, 'Other', NULL, 'Karavan', 'active',   @seller_id, 'Remove denied request test item'),
    (92144, 'Remove Denied Item 4', 44.00, 'Good', NULL, 'Other', NULL, 'Karavan', 'active',   @seller_id, 'Remove denied request test item'),
    (92145, 'Remove Denied Item 5', 45.00, 'Good', NULL, 'Other', NULL, 'Karavan', 'active',   @seller_id, 'Remove denied request test item'),
    (92146, 'Remove Denied Item 6', 46.00, 'Good', NULL, 'Other', NULL, 'Karavan', 'sold',     @seller_id, 'Remove denied request test item'),
    (92147, 'Remove Denied Item 7', 47.00, 'Good', NULL, 'Other', NULL, 'Karavan', 'active',   @buyer_id,  'Remove denied request test item'),
    (92148, 'Remove Denied Item 8', 48.00, 'Good', NULL, 'Other', NULL, 'Karavan', 'inactive', @seller_id, 'Remove denied request test item');

-- Several requests per buyer and item exist here on purpose (92142 has two denied ones); the app itself only allows that after a denial.
INSERT IGNORE INTO meeting_requests (request_id, buyer_id, listing_id, meeting_date, meeting_time, location_id, location_label, status)
VALUES
    (92141, @buyer_id,  92141, '2030-12-31', '15:00:00', NULL, 'Remove denied request test location', 'denied'),
    (92142, @buyer_id,  92142, '2030-12-31', '15:00:00', NULL, 'Remove denied request test location', 'denied'),
    (92143, @buyer_id,  92143, '2030-12-31', '15:00:00', NULL, 'Remove denied request test location', 'pending'),
    (92144, @buyer_id,  92144, '2030-12-31', '15:00:00', NULL, 'Remove denied request test location', 'approved'),
    (92145, @buyer_id,  92145, '2030-12-31', '15:00:00', NULL, 'Remove denied request test location', 'location_change_requested'),
    (92146, @buyer_id,  92146, '2030-12-31', '15:00:00', NULL, 'Remove denied request test location', 'denied'),
    (92147, @seller_id, 92147, '2030-12-31', '15:00:00', NULL, 'Remove denied request test location', 'denied'),
    (92148, @buyer_id,  92148, '2030-12-31', '15:00:00', NULL, 'Remove denied request test location', 'denied'),
    (92149, @buyer_id,  92142, '2030-12-31', '15:00:00', NULL, 'Remove denied request test location', 'denied');

-- Check 1: 8 rows, description 'Remove denied request test item' on every row (92146 sold, 92148 inactive, 92147 owner_id = david.buyer's id, the rest owner_id = david.seller's id)
SELECT listing_id, name, community, status, owner_id, description FROM listings WHERE listing_id BETWEEN 92141 AND 92150 ORDER BY listing_id;
-- Check 2: 9 requests: 92141 denied | 92142 denied | 92143 pending | 92144 approved | 92145 location_change_requested | 92146 denied | 92147 denied | 92148 denied | 92149 denied (on listing 92142)
SELECT request_id, buyer_id, listing_id, status FROM meeting_requests WHERE request_id BETWEEN 92141 AND 92150 ORDER BY request_id;
-- Check 3: david.seller@test.com's id must be 259 (the expected answers in card #237 use seller_id 259)
SELECT id, email FROM users WHERE LOWER(email) IN ('david.seller@test.com', 'david.buyer@test.com');
