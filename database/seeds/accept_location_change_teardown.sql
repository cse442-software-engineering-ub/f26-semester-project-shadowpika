-- Accept location change QA teardown (card #219): removes everything database/seeds/accept_location_change_test.sql adds,
-- so david.buyer@test.com and david.seller@test.com no longer see the test requests under MY PURCHASE REQUESTS
-- and REQUESTS FOR MY ITEMS.
-- Safe to re-run, and safe to run when the seed was never run (it then changes nothing).
-- Touches only the fixture's own listings (92101-92107 with the marker description); community memberships
-- and Karavan settings are not changed.

-- Listings: their meeting requests (92101-92107), favorites and recently viewed rows go with them (foreign keys).
-- The marker is written out here: comparing the column with a variable fails on the team DB (#1267, mixed collations).
DELETE FROM listings WHERE listing_id BETWEEN 92101 AND 92107 AND description = 'Accept location change test item';

-- Check: no rows
SELECT listing_id, name FROM listings WHERE listing_id BETWEEN 92101 AND 92107 AND description = 'Accept location change test item';
SELECT r.request_id, r.listing_id, r.status
  FROM meeting_requests r JOIN listings l ON l.listing_id = r.listing_id
 WHERE r.listing_id BETWEEN 92101 AND 92107 AND l.description = 'Accept location change test item';
