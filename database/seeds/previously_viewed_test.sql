-- Previously viewed items QA fixture (card #216): two approved test communities, listings 92001-92021, the
-- memberships of david.buyer@test.com and david.seller@test.com, and their recently viewed items.
-- Run after database/migrations/008-010 and 014 (community_members, join requests, Karavan campus community, recently_viewed).
-- david.buyer@test.com and david.seller@test.com must already be registered.
-- Safe to re-run: resets the test rows, the two users' memberships in the test communities, and those two users' recently viewed rows.
-- The communities use auto-generated ids (the unique email keeps re-runs from duplicating them), so they never overwrite other rows.
-- If ids 92001-92021 are already used by other rows, the checks below show them instead of overwriting them.
-- Undo everything with database/seeds/previously_viewed_teardown.sql.

SET @buyer_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('david.buyer@test.com') LIMIT 1);
SET @seller_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('david.seller@test.com') LIMIT 1);

INSERT IGNORE INTO admin_requests (
    full_name, business_name, email, phone, password_hash,
    proof_file_name, proof_original_name, proof_mime_type, status,
    user_id, reviewed_by, reviewed_at
) VALUES
    ('Previously Viewed Test Hall', 'Previously Viewed Test Hall', 'previously-viewed-test-hall@test.invalid',
     '000-000-0000', 'test-only-not-a-login-hash', 'none', 'none.pdf', 'application/pdf', 'approved',
     NULL, NULL, NOW()),
    ('Previously Viewed Test Outside', 'Previously Viewed Test Outside', 'previously-viewed-test-outside@test.invalid',
     '000-000-0000', 'test-only-not-a-login-hash', 'none', 'none.pdf', 'application/pdf', 'approved',
     NULL, NULL, NOW());

SET @hall_id = (SELECT id FROM admin_requests WHERE email = 'previously-viewed-test-hall@test.invalid' LIMIT 1);
SET @outside_id = (SELECT id FROM admin_requests WHERE email = 'previously-viewed-test-outside@test.invalid' LIMIT 1);

-- Back to approved if an earlier run or test changed them
UPDATE admin_requests SET status = 'approved'
 WHERE email IN ('previously-viewed-test-hall@test.invalid', 'previously-viewed-test-outside@test.invalid');

-- Listings: remove only this fixture's own rows (their recently viewed rows go with them), then add them fresh (sold/inactive/owner reset).
-- The marker is written out here: comparing the column with a variable fails on the team DB (#1267, mixed collations).
DELETE FROM listings WHERE listing_id BETWEEN 92001 AND 92021 AND description = 'Previously viewed test item';

INSERT IGNORE INTO listings (listing_id, name, price, `condition`, image_url, category, related_course, community, status, owner_id, description)
VALUES
    (92001, 'Viewed Test Item 01', 1.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Hall', 'active', NULL, 'Previously viewed test item'),
    (92002, 'Viewed Test Item 02', 2.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Hall', 'active', NULL, 'Previously viewed test item'),
    (92003, 'Viewed Test Item 03', 3.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Hall', 'active', NULL, 'Previously viewed test item'),
    (92004, 'Viewed Test Item 04', 4.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Hall', 'active', NULL, 'Previously viewed test item'),
    (92005, 'Viewed Test Item 05', 5.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Hall', 'active', NULL, 'Previously viewed test item'),
    (92006, 'Viewed Test Item 06', 6.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Hall', 'active', NULL, 'Previously viewed test item'),
    (92007, 'Viewed Test Item 07', 7.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Hall', 'active', NULL, 'Previously viewed test item'),
    (92008, 'Viewed Test Item 08', 8.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Hall', 'active', NULL, 'Previously viewed test item'),
    (92009, 'Viewed Test Item 09', 9.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Hall', 'active', NULL, 'Previously viewed test item'),
    (92010, 'Viewed Test Item 10', 10.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Hall', 'active', NULL, 'Previously viewed test item'),
    (92011, 'Viewed Test Item 11', 11.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Hall', 'active', NULL, 'Previously viewed test item'),
    (92012, 'Viewed Test Item 12', 12.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Hall', 'active', NULL, 'Previously viewed test item'),
    (92013, 'Viewed Test Item 13', 13.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Hall', 'active', NULL, 'Previously viewed test item'),
    (92014, 'Viewed Test Item 14', 14.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Hall', 'active', NULL, 'Previously viewed test item'),
    (92015, 'Viewed Test Item 15', 15.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Hall', 'active', NULL, 'Previously viewed test item'),
    (92016, 'Viewed Test Item 16', 16.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Hall', 'active', NULL, 'Previously viewed test item'),
    (92017, 'Viewed Test Item 17', 17.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Hall', 'active', NULL, 'Previously viewed test item'),
    (92018, 'Viewed Sold Item', 18.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Hall', 'sold', NULL, 'Previously viewed test item'),
    (92019, 'Viewed Hidden Item', 19.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Hall', 'inactive', NULL, 'Previously viewed test item'),
    (92020, 'Viewed Own Item', 20.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Hall', 'active', @buyer_id, 'Previously viewed test item'),
    (92021, 'Viewed Outside Item', 21.00, 'Good', NULL, 'Other', NULL, 'Previously Viewed Test Outside', 'active', NULL, 'Previously viewed test item');

-- Memberships: both users in Hall, never in Outside
DELETE FROM community_join_requests WHERE user_id IN (@buyer_id, @seller_id) AND community_id IN (@hall_id, @outside_id);
DELETE FROM community_members WHERE user_id IN (@buyer_id, @seller_id) AND community_id = @outside_id;

INSERT INTO community_members (user_id, community_id, shopping)
VALUES
    (@buyer_id, @hall_id, 0),
    (@seller_id, @hall_id, 0)
ON DUPLICATE KEY UPDATE shopping = VALUES(shopping);

-- Campus community (Karavan, legacy All of UB): every user is in it without a row, and a row only records that the
-- user turned Karavan off under Shopping from. Remove any such row so both users shop from Karavan.
DELETE community_members FROM community_members
  JOIN admin_requests ON admin_requests.id = community_members.community_id
 WHERE community_members.user_id IN (@buyer_id, @seller_id)
   AND LOWER(TRIM(admin_requests.business_name)) IN ('karavan', 'all of ub');

-- Recently viewed: replace only these two users' rows
DELETE FROM recently_viewed WHERE user_id IN (@buyer_id, @seller_id);

INSERT INTO recently_viewed (user_id, listing_id, viewed_at)
VALUES
    (@buyer_id, 92018, '2026-11-02 10:00:01.000000'),
    (@buyer_id, 92019, '2026-11-02 10:00:02.000000'),
    (@buyer_id, 92021, '2026-11-02 10:00:03.000000'),
    (@seller_id, 92001, '2026-11-02 10:00:01.000000'),
    (@seller_id, 92002, '2026-11-02 10:00:02.000000'),
    (@seller_id, 92003, '2026-11-02 10:00:03.000000'),
    (@seller_id, 92004, '2026-11-02 10:00:04.000000'),
    (@seller_id, 92005, '2026-11-02 10:00:05.000000'),
    (@seller_id, 92006, '2026-11-02 10:00:06.000000'),
    (@seller_id, 92007, '2026-11-02 10:00:07.000000'),
    (@seller_id, 92008, '2026-11-02 10:00:08.000000'),
    (@seller_id, 92009, '2026-11-02 10:00:09.000000'),
    (@seller_id, 92010, '2026-11-02 10:00:10.000000'),
    (@seller_id, 92011, '2026-11-02 10:00:11.000000'),
    (@seller_id, 92012, '2026-11-02 10:00:12.000000'),
    (@seller_id, 92013, '2026-11-02 10:00:13.000000'),
    (@seller_id, 92014, '2026-11-02 10:00:14.000000'),
    (@seller_id, 92015, '2026-11-02 10:00:15.000000'),
    (@seller_id, 92016, '2026-11-02 10:00:16.000000'),
    (@seller_id, 92017, '2026-11-02 10:00:17.000000');

-- Check: both users found (not NULL) and both communities approved
SELECT @buyer_id AS buyer_id, @seller_id AS seller_id;
SELECT id, business_name, status FROM admin_requests WHERE id IN (@hall_id, @outside_id);
-- Check: 21 rows, all with the marker description (17 active, sold, inactive, own, outside)
SELECT listing_id, name, price, community, status, owner_id, description FROM listings WHERE listing_id BETWEEN 92001 AND 92021;
-- Check: both users in Hall only (no Karavan row, so Karavan stays ticked), neither in Outside
SELECT user_id, community_id, shopping FROM community_members WHERE user_id IN (@buyer_id, @seller_id);
-- Check: 3 rows for the buyer, 17 for the seller
SELECT user_id, listing_id, viewed_at FROM recently_viewed WHERE user_id IN (@buyer_id, @seller_id) ORDER BY user_id, viewed_at;

-- Teardown: database/seeds/previously_viewed_teardown.sql
