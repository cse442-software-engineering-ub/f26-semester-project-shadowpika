-- Remove denied request QA teardown (card #237): removes the listings database/seeds/remove_denied_request_test.sql adds,
-- and with them (foreign key cascade) the purchase requests on them.
-- Safe to re-run, and safe to run when the seed was never run (it then changes nothing).
-- Touches only listings 92141-92148 with the marker description.

-- The marker is written out here: comparing the column with a variable fails on the team DB (#1267, mixed collations).
DELETE FROM listings WHERE listing_id BETWEEN 92141 AND 92150 AND description = 'Remove denied request test item';

-- Check 1: no rows
SELECT listing_id, name FROM listings WHERE listing_id BETWEEN 92141 AND 92150 AND description = 'Remove denied request test item';
-- Check 2: no rows (requests on a foreign row that happens to use one of these ids are not ours and would show here)
SELECT request_id, listing_id, status FROM meeting_requests WHERE request_id BETWEEN 92141 AND 92150 AND location_label = 'Remove denied request test location';
