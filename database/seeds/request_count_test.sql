-- Request count QA fixture (card #234): listings 92131-92138 and the purchase requests on them
-- (david.buyer@test.com and david.seller@test.com are the requesters; 92134 is owned by david.buyer@test.com).
-- Run AFTER database/seeds/previously_viewed_test.sql, which adds the two test communities and the two users' memberships.
-- Safe to re-run: removes only its own listings (ids 92131-92138 with the marker description; their requests go with
-- them) and adds everything fresh. Requests get automatic ids and are added only onto those marker listings.
-- If an id 92131-92138 is already used by another row, the check below shows it instead of overwriting it.
-- Undo with database/seeds/request_count_teardown.sql.

SET @buyer_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('david.buyer@test.com') LIMIT 1);
SET @seller_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('david.seller@test.com') LIMIT 1);

-- The marker is written out here: comparing the column with a variable fails on the team DB (#1267, mixed collations).
DELETE FROM listings WHERE listing_id BETWEEN 92131 AND 92138 AND description = 'Request count test item';

INSERT IGNORE INTO listings (listing_id, name, price, `condition`, image_url, category, related_course, community, status, owner_id, description)
VALUES
    (92131, 'Count Zero Item',         31.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Hall',    'active',   NULL,       'Request count test item'),
    (92132, 'Count One Item',          32.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Hall',    'active',   NULL,       'Request count test item'),
    (92133, 'Count Mixed Item',        33.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Hall',    'active',   NULL,       'Request count test item'),
    (92134, 'Count Own Item',          34.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Hall',    'active',   @buyer_id,  'Request count test item'),
    (92135, 'Count Sold Item',         35.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Hall',    'sold',     NULL,       'Request count test item'),
    (92136, 'Count Outside Item',      36.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Outside', 'active',   NULL,       'Request count test item'),
    (92137, 'Count Outside Sold Item', 37.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Outside', 'sold',     NULL,       'Request count test item'),
    (92138, 'Count Hidden Item',       38.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Hall',    'inactive', NULL,       'Request count test item');

-- Purchase requests: one statement per request, each selecting only our own marker listing so a foreign row is never touched.
INSERT INTO meeting_requests (buyer_id, listing_id, meeting_date, meeting_time, location_id, location_label, status)
SELECT @buyer_id, listing_id, '2030-12-31', '15:00:00', NULL, 'Request count test location', 'denied'
  FROM listings WHERE listing_id = 92131 AND description = 'Request count test item';

INSERT INTO meeting_requests (buyer_id, listing_id, meeting_date, meeting_time, location_id, location_label, status)
SELECT @buyer_id, listing_id, '2030-12-31', '15:00:00', NULL, 'Request count test location', 'pending'
  FROM listings WHERE listing_id = 92132 AND description = 'Request count test item';

INSERT INTO meeting_requests (buyer_id, listing_id, meeting_date, meeting_time, location_id, location_label, status)
SELECT @buyer_id, listing_id, '2030-12-31', '15:00:00', NULL, 'Request count test location', 'pending'
  FROM listings WHERE listing_id = 92133 AND description = 'Request count test item';

INSERT INTO meeting_requests (buyer_id, listing_id, meeting_date, meeting_time, location_id, location_label, status)
SELECT @seller_id, listing_id, '2030-12-31', '15:00:00', NULL, 'Request count test location', 'approved'
  FROM listings WHERE listing_id = 92133 AND description = 'Request count test item';

INSERT INTO meeting_requests (buyer_id, listing_id, meeting_date, meeting_time, location_id, location_label, status)
SELECT @buyer_id, listing_id, '2030-12-31', '15:00:00', NULL, 'Request count test location', 'location_change_requested'
  FROM listings WHERE listing_id = 92133 AND description = 'Request count test item';

INSERT INTO meeting_requests (buyer_id, listing_id, meeting_date, meeting_time, location_id, location_label, status)
SELECT @seller_id, listing_id, '2030-12-31', '15:00:00', NULL, 'Request count test location', 'denied'
  FROM listings WHERE listing_id = 92133 AND description = 'Request count test item';

INSERT INTO meeting_requests (buyer_id, listing_id, meeting_date, meeting_time, location_id, location_label, status)
SELECT @seller_id, listing_id, '2030-12-31', '15:00:00', NULL, 'Request count test location', 'pending'
  FROM listings WHERE listing_id = 92134 AND description = 'Request count test item';

INSERT INTO meeting_requests (buyer_id, listing_id, meeting_date, meeting_time, location_id, location_label, status)
SELECT @seller_id, listing_id, '2030-12-31', '15:00:00', NULL, 'Request count test location', 'approved'
  FROM listings WHERE listing_id = 92134 AND description = 'Request count test item';

INSERT INTO meeting_requests (buyer_id, listing_id, meeting_date, meeting_time, location_id, location_label, status)
SELECT @buyer_id, listing_id, '2030-12-31', '15:00:00', NULL, 'Request count test location', 'pending'
  FROM listings WHERE listing_id = 92135 AND description = 'Request count test item';

INSERT INTO meeting_requests (buyer_id, listing_id, meeting_date, meeting_time, location_id, location_label, status)
SELECT @seller_id, listing_id, '2030-12-31', '15:00:00', NULL, 'Request count test location', 'pending'
  FROM listings WHERE listing_id = 92136 AND description = 'Request count test item';

INSERT INTO meeting_requests (buyer_id, listing_id, meeting_date, meeting_time, location_id, location_label, status)
SELECT @seller_id, listing_id, '2030-12-31', '15:00:00', NULL, 'Request count test location', 'pending'
  FROM listings WHERE listing_id = 92137 AND description = 'Request count test item';

INSERT INTO meeting_requests (buyer_id, listing_id, meeting_date, meeting_time, location_id, location_label, status)
SELECT @buyer_id, listing_id, '2030-12-31', '15:00:00', NULL, 'Request count test location', 'pending'
  FROM listings WHERE listing_id = 92138 AND description = 'Request count test item';

-- Check 1: 8 rows, description 'Request count test item' on every row
-- (any other description means that id belongs to another row and was not overwritten; 92134 owner_id = david.buyer's id)
SELECT listing_id, name, community, status, owner_id, description FROM listings WHERE listing_id BETWEEN 92131 AND 92138 ORDER BY listing_id;

-- Check 2: 12 requests in total:
--   92131 denied 1 | 92132 pending 1 | 92133 pending 1, approved 1, location_change_requested 1, denied 1
--   92134 pending 1, approved 1 | 92135 pending 1 | 92136 pending 1 | 92137 pending 1 | 92138 pending 1
SELECT listing_id, status, COUNT(*) AS requests FROM meeting_requests WHERE listing_id BETWEEN 92131 AND 92138 GROUP BY listing_id, status ORDER BY listing_id, status;
