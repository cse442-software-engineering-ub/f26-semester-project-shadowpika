-- Deny location change QA fixture (card #219): listings 92111-92120 and meeting requests 92111-92120 for
-- david.buyer@test.com and david.seller@test.com (location change requested with a saved original location, sold item,
-- pending, approved, denied, another user's request, hidden item, no saved original location, and two requests that
-- carry an accepted / denied result).
-- Run after database/migrations/015_location_change_response.sql, database/seeds/listings.sql and database/migrations/meeting_requests.sql.
-- david.buyer@test.com and david.seller@test.com must already be registered.
-- Safe to re-run: resets only the rows with ids 92111-92120 that carry this fixture's marker description.
-- It never changes community memberships or Karavan settings, so both accounts stay as they are.
-- If ids 92111-92120 are already used by other rows, the checks below show them missing instead of overwriting them (INSERT IGNORE).
-- To undo: DELETE FROM listings WHERE listing_id BETWEEN 92111 AND 92120 AND description = 'Deny location change test item';

SET @buyer_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('david.buyer@test.com') LIMIT 1);
SET @seller_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('david.seller@test.com') LIMIT 1);

-- Remove only this fixture's own rows, then add them fresh (status/owner reset).
-- The marker is written out here: comparing the column with a variable fails on the team DB (#1267, mixed collations).
DELETE FROM meeting_requests WHERE request_id BETWEEN 92111 AND 92120 AND listing_id BETWEEN 92111 AND 92120;
DELETE FROM listings WHERE listing_id BETWEEN 92111 AND 92120 AND description = 'Deny location change test item';

INSERT IGNORE INTO listings (listing_id, name, price, `condition`, image_url, category, related_course, community, status, owner_id, description)
VALUES
    (92111, 'Deny Test Item 1', 21.00, 'Good', NULL, 'Other', NULL, 'Karavan', 'active', @seller_id, 'Deny location change test item'),
    (92112, 'Deny Test Item 2', 22.00, 'Good', NULL, 'Other', NULL, 'Karavan', 'active', NULL, 'Deny location change test item'),
    (92113, 'Deny Test Item 3', 23.00, 'Good', NULL, 'Other', NULL, 'Karavan', 'active', @seller_id, 'Deny location change test item'),
    (92114, 'Deny Test Item 4', 24.00, 'Good', NULL, 'Other', NULL, 'Karavan', 'active', NULL, 'Deny location change test item'),
    (92115, 'Deny Test Item 5', 25.00, 'Good', NULL, 'Other', NULL, 'Karavan', 'active', NULL, 'Deny location change test item'),
    (92116, 'Deny Test Item 6', 26.00, 'Good', NULL, 'Other', NULL, 'Karavan', 'active', @buyer_id, 'Deny location change test item'),
    (92117, 'Deny Test Item 7', 27.00, 'Good', NULL, 'Other', NULL, 'Karavan', 'inactive', NULL, 'Deny location change test item'),
    (92118, 'Deny Test Item 8', 28.00, 'Good', NULL, 'Other', NULL, 'Karavan', 'active', NULL, 'Deny location change test item'),
    (92119, 'Deny Test Item 9', 29.00, 'Good', NULL, 'Other', NULL, 'Karavan', 'active', @seller_id, 'Deny location change test item'),
    (92120, 'Deny Test Item 10', 30.00, 'Good', NULL, 'Other', NULL, 'Karavan', 'active', @seller_id, 'Deny location change test item');

-- Item 2 was sold after the seller suggested the new location
UPDATE listings SET status = 'sold' WHERE listing_id = 92112 AND description = 'Deny location change test item';

INSERT IGNORE INTO meeting_requests
    (request_id, buyer_id, listing_id, meeting_date, meeting_time, location_id, location_label, status,
     original_location_id, original_location_label, location_change_result)
VALUES
    (92111, @buyer_id,  92111, '2026-12-18', '13:00:00', 91002, 'Student Union Main Entrance', 'location_change_requested', 91001, 'Capen Hall Main Entrance', NULL),
    (92112, @buyer_id,  92112, '2026-12-18', '13:00:00', 91002, 'Student Union Main Entrance', 'location_change_requested', 91001, 'Capen Hall Main Entrance', NULL),
    (92113, @buyer_id,  92113, '2026-12-18', '13:00:00', 91001, 'Capen Hall Main Entrance',    'pending',                   NULL, NULL, NULL),
    (92114, @buyer_id,  92114, '2026-12-18', '13:00:00', 91001, 'Capen Hall Main Entrance',    'approved',                  NULL, NULL, NULL),
    (92115, @buyer_id,  92115, '2026-12-18', '13:00:00', 91001, 'Capen Hall Main Entrance',    'denied',                    NULL, NULL, NULL),
    (92116, @seller_id, 92116, '2026-12-18', '13:00:00', 91002, 'Student Union Main Entrance', 'location_change_requested', 91001, 'Capen Hall Main Entrance', NULL),
    (92117, @buyer_id,  92117, '2026-12-18', '13:00:00', 91002, 'Student Union Main Entrance', 'location_change_requested', 91001, 'Capen Hall Main Entrance', NULL),
    (92118, @buyer_id,  92118, '2026-12-18', '13:00:00', 91002, 'Student Union Main Entrance', 'location_change_requested', NULL, NULL, NULL),
    (92119, @buyer_id,  92119, '2026-12-18', '13:00:00', 91002, 'Student Union Main Entrance', 'approved',                  NULL, NULL, 'accepted'),
    (92120, @buyer_id,  92120, '2026-12-18', '13:00:00', 91001, 'Capen Hall Main Entrance',    'pending',                   NULL, NULL, 'denied');

-- Check: both users found (not NULL)
SELECT @buyer_id AS buyer_id, @seller_id AS seller_id;
-- Check: 10 rows with the marker description (92112 sold, 92117 inactive, 92116 owned by the buyer, 92111/92113/92119/92120 owned by the seller, the rest without an owner); a missing row means its id was taken by another row
SELECT listing_id, name, price, status, owner_id, description FROM listings WHERE listing_id BETWEEN 92111 AND 92120;
-- Check: 10 requests (a missing row means its id was taken by another row)
SELECT r.request_id, r.buyer_id, r.listing_id, r.location_label, r.status, r.original_location_label, r.location_change_result, l.status AS listing_status
  FROM meeting_requests r JOIN listings l ON l.listing_id = r.listing_id
 WHERE r.request_id BETWEEN 92111 AND 92120 ORDER BY r.request_id;
