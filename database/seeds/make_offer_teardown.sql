-- Make offer QA teardown (card #116): removes everything database/seeds/make_offer_test.sql adds, so
-- david.seller@test.com no longer has the four test listings (or any other listing with the marker description).
-- Safe to re-run, and safe to run when the seed was never run (it then changes nothing).
-- Touches only listings owned by david.seller@test.com whose description is 'Make offer test item'; their photos and
-- purchase requests (and favorites and recently viewed rows) go with them (foreign keys).
-- The marker is written out here: comparing the column with a variable fails on the team DB (#1267, mixed collations).

SET @seller_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('david.seller@test.com') LIMIT 1);

DELETE FROM listings WHERE owner_id = @seller_id AND description = 'Make offer test item';

-- Check: no rows
SELECT l.listing_id, l.name
  FROM listings l JOIN users u ON u.id = l.owner_id
 WHERE LOWER(u.email) = 'david.seller@test.com' AND l.description = 'Make offer test item';
