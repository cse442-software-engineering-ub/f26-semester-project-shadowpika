-- Previously viewed items QA teardown (card #216): removes everything database/seeds/previously_viewed_test.sql adds,
-- so david.buyer@test.com and david.seller@test.com are back to a normal account: in no extra community
-- (the navbar shows Join a Community) and shopping from Karavan.
-- Safe to re-run, and safe to run when the seed was never run (it then changes nothing).
-- Touches only the fixture's own rows (listings 92001-92021 with the marker description, the two test communities)
-- and the two test users' Karavan opt-out rows.

SET @buyer_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('david.buyer@test.com') LIMIT 1);
SET @seller_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('david.seller@test.com') LIMIT 1);

-- Listings: their recently viewed, favorites and meeting request rows go with them (foreign keys).
-- The marker is written out here: comparing the column with a variable fails on the team DB (#1267, mixed collations).
DELETE FROM listings WHERE listing_id BETWEEN 92001 AND 92021 AND description = 'Previously viewed test item';

-- Test communities: their memberships and join requests go with them (foreign keys).
DELETE FROM admin_requests
 WHERE email IN ('previously-viewed-test-hall@test.invalid', 'previously-viewed-test-outside@test.invalid');

-- Karavan opt-out rows an earlier version of the seed added (a Karavan row means the user turned Karavan off).
DELETE community_members FROM community_members
  JOIN admin_requests ON admin_requests.id = community_members.community_id
 WHERE community_members.user_id IN (@buyer_id, @seller_id)
   AND LOWER(TRIM(admin_requests.business_name)) IN ('karavan', 'all of ub');

-- Check: no rows
SELECT listing_id, name FROM listings WHERE listing_id BETWEEN 92001 AND 92021 AND description = 'Previously viewed test item';
SELECT id, business_name FROM admin_requests
 WHERE email IN ('previously-viewed-test-hall@test.invalid', 'previously-viewed-test-outside@test.invalid');
-- Check: no Karavan or test-community rows for the two users (rows for communities they joined themselves stay)
SELECT community_members.user_id, admin_requests.business_name, community_members.shopping
  FROM community_members
  JOIN admin_requests ON admin_requests.id = community_members.community_id
 WHERE community_members.user_id IN (@buyer_id, @seller_id);
