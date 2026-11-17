-- Share listing QA fixture (card #157, Tests 8 and 9): listing 92022 'Viewed Outside Sold Item', a sold listing in
-- Previously Viewed Test Outside (a community david.buyer@test.com is not a member of).
-- Run AFTER database/seeds/previously_viewed_test.sql, which adds that community and the other listings 92001-92021.
-- Safe to re-run: removes only its own row (id 92022 with the marker description) and adds it fresh.
-- If id 92022 is already used by another row, the check below shows it instead of overwriting it.
-- Undo with database/seeds/share_listing_teardown.sql.

-- The marker is written out here: comparing the column with a variable fails on the team DB (#1267, mixed collations).
DELETE FROM listings WHERE listing_id = 92022 AND description = 'Share listing test item';

INSERT IGNORE INTO listings (listing_id, name, price, `condition`, image_url, category, related_course, community, status, owner_id, description)
VALUES
    (92022, 'Viewed Outside Sold Item', 22.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Outside', 'sold', NULL, 'Share listing test item');

-- Check: 1 row, sold, in Previously Viewed Test Outside, description 'Share listing test item'
-- (any other description means id 92022 belongs to another row and was not overwritten)
SELECT listing_id, name, price, community, status, owner_id, description FROM listings WHERE listing_id = 92022;
