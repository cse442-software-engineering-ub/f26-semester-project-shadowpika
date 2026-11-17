-- Request count QA teardown (card #234): removes the listings database/seeds/request_count_test.sql adds,
-- and with them (foreign key cascade) the purchase requests on them.
-- Safe to re-run, and safe to run when the seed was never run (it then changes nothing).
-- Touches only listings 92131-92138 with the marker description.

-- The marker is written out here: comparing the column with a variable fails on the team DB (#1267, mixed collations).
DELETE FROM listings WHERE listing_id BETWEEN 92131 AND 92138 AND description = 'Request count test item';

-- Check 1: no rows
SELECT listing_id, name FROM listings WHERE listing_id BETWEEN 92131 AND 92138 AND description = 'Request count test item';

-- Check 2: no rows (requests on a foreign row that happens to use one of these ids are not ours and would show here)
SELECT request_id, listing_id, status FROM meeting_requests WHERE listing_id BETWEEN 92131 AND 92138 AND location_label = 'Request count test location';
