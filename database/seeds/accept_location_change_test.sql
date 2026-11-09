-- Accept location change QA fixture (card #219): listings 92101-92107 and meeting requests 92101-92107 for
-- david.buyer@test.com and david.seller@test.com (location change requested, sold item, pending, approved, denied, another user's request, hidden item).
-- Run after database/seeds/listings.sql and database/migrations/meeting_requests.sql.
-- david.buyer@test.com and david.seller@test.com must already be registered.
-- Safe to re-run: resets only the rows with ids 92101-92107 that carry this fixture's marker description.
-- It never changes community memberships or Karavan settings, so both accounts stay as they are.
-- If ids 92101-92107 are already used by other rows, the checks below show them missing instead of overwriting them (INSERT IGNORE).
-- Undo everything with database/seeds/accept_location_change_teardown.sql.

SET @buyer_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('david.buyer@test.com') LIMIT 1);
SET @seller_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('david.seller@test.com') LIMIT 1);

-- Remove only this fixture's own rows, then add them fresh (status/owner reset).
-- The marker is written out here: comparing the column with a variable fails on the team DB (#1267, mixed collations).
DELETE FROM meeting_requests WHERE request_id BETWEEN 92101 AND 92107 AND listing_id BETWEEN 92101 AND 92107;
DELETE FROM listings WHERE listing_id BETWEEN 92101 AND 92107 AND description = 'Accept location change test item';

INSERT IGNORE INTO listings (listing_id, name, price, `condition`, image_url, category, related_course, community, status, owner_id, description)
VALUES
    (92101, 'Accept Test Item 1', 11.00, 'Good', NULL, 'Other', NULL, 'Karavan', 'active', @seller_id, 'Accept location change test item'),
    (92102, 'Accept Test Item 2', 12.00, 'Good', NULL, 'Other', NULL, 'Karavan', 'active', @seller_id, 'Accept location change test item'),
    (92103, 'Accept Test Item 3', 13.00, 'Good', NULL, 'Other', NULL, 'Karavan', 'active', @seller_id, 'Accept location change test item'),
    (92104, 'Accept Test Item 4', 14.00, 'Good', NULL, 'Other', NULL, 'Karavan', 'active', @seller_id, 'Accept location change test item'),
    (92105, 'Accept Test Item 5', 15.00, 'Good', NULL, 'Other', NULL, 'Karavan', 'active', @seller_id, 'Accept location change test item'),
    (92106, 'Accept Test Item 6', 16.00, 'Good', NULL, 'Other', NULL, 'Karavan', 'active', @buyer_id, 'Accept location change test item'),
    (92107, 'Accept Test Item 7', 17.00, 'Good', NULL, 'Other', NULL, 'Karavan', 'inactive', @seller_id, 'Accept location change test item');

-- Item 2 was sold after the seller suggested the new location
UPDATE listings SET status = 'sold' WHERE listing_id = 92102 AND description = 'Accept location change test item';

INSERT IGNORE INTO meeting_requests (request_id, buyer_id, listing_id, meeting_date, meeting_time, location_id, location_label, status)
VALUES
    (92101, @buyer_id, 92101, '2026-12-18', '13:00:00', 91002, 'Student Union Main Entrance', 'location_change_requested'),
    (92102, @buyer_id, 92102, '2026-12-18', '13:00:00', 91002, 'Student Union Main Entrance', 'location_change_requested'),
    (92103, @buyer_id, 92103, '2026-12-18', '13:00:00', 91001, 'Capen Hall Main Entrance', 'pending'),
    (92104, @buyer_id, 92104, '2026-12-18', '13:00:00', 91001, 'Capen Hall Main Entrance', 'approved'),
    (92105, @buyer_id, 92105, '2026-12-18', '13:00:00', 91001, 'Capen Hall Main Entrance', 'denied'),
    (92106, @seller_id, 92106, '2026-12-18', '13:00:00', 91001, 'Capen Hall Main Entrance', 'location_change_requested'),
    (92107, @buyer_id, 92107, '2026-12-18', '13:00:00', 91002, 'Student Union Main Entrance', 'location_change_requested');

-- Check: both users found (not NULL)
SELECT @buyer_id AS buyer_id, @seller_id AS seller_id;
-- Check: 7 rows with the marker description (92102 sold, 92107 inactive, 92106 owned by the buyer, the rest active and owned by the seller); a missing row means its id was taken by another row
SELECT listing_id, name, price, status, owner_id, description FROM listings WHERE listing_id BETWEEN 92101 AND 92107;
-- Check: 7 requests (a missing row means its id was taken by another row)
SELECT r.request_id, r.buyer_id, r.listing_id, r.location_label, r.status, l.status AS listing_status
  FROM meeting_requests r JOIN listings l ON l.listing_id = r.listing_id
 WHERE r.request_id BETWEEN 92101 AND 92107 ORDER BY r.request_id;
