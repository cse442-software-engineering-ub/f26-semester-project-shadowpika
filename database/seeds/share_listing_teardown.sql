-- Share listing QA teardown (card #157): removes the listing database/seeds/share_listing_test.sql adds.
-- Safe to re-run, and safe to run when the seed was never run (it then changes nothing).
-- Touches only listing 92022 with the marker description.

-- The marker is written out here: comparing the column with a variable fails on the team DB (#1267, mixed collations).
DELETE FROM listings WHERE listing_id = 92022 AND description = 'Share listing test item';

-- Check: no rows
SELECT listing_id, name FROM listings WHERE listing_id = 92022 AND description = 'Share listing test item';
