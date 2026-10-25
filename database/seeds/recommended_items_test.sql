-- Recommended items QA fixture (card #199): three approved test communities, 23 test listings, and the
-- memberships of chun.recommend@test.com (shops from Recommended Test Hall only).
-- Run after database/migrations/006-010 (community_members, join requests, Karavan campus community).
-- chun.recommend@test.com must already be registered (Test Setup step 1 of the card).
-- Safe to re-run: resets the test rows and that one user's memberships; other rows are never overwritten.
-- If ids 91801-91823 are already used by other rows, the checks below show them instead of overwriting them.

SET @marker = 'Recommended items test item';
SET @user_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('chun.recommend@test.com') LIMIT 1);

INSERT IGNORE INTO admin_requests (
    id, full_name, business_name, email, phone, password_hash,
    proof_file_name, proof_original_name, proof_mime_type, status,
    user_id, reviewed_by, reviewed_at
) VALUES
    (91801, 'Recommended Test Hall', 'Recommended Test Hall', 'recommended-test-hall@test.invalid',
     '000-000-0000', 'test-only-not-a-login-hash', 'none', 'none.pdf', 'application/pdf', 'approved',
     NULL, NULL, NOW()),
    (91802, 'Recommended Test Annex', 'Recommended Test Annex', 'recommended-test-annex@test.invalid',
     '000-000-0000', 'test-only-not-a-login-hash', 'none', 'none.pdf', 'application/pdf', 'approved',
     NULL, NULL, NOW()),
    (91803, 'Recommended Test Empty', 'Recommended Test Empty', 'recommended-test-empty@test.invalid',
     '000-000-0000', 'test-only-not-a-login-hash', 'none', 'none.pdf', 'application/pdf', 'approved',
     NULL, NULL, NOW());

-- Back to approved if an earlier run or test changed them
UPDATE admin_requests SET status = 'approved'
 WHERE id IN (91801, 91802, 91803) AND email LIKE 'recommended-test-%@test.invalid';

-- Listings: remove only this fixture's own rows, then add them fresh (sold/inactive/owner reset)
DELETE FROM listings WHERE listing_id BETWEEN 91801 AND 91823 AND description = @marker;

INSERT IGNORE INTO listings (listing_id, name, price, `condition`, image_url, category, related_course, community, status, owner_id, description)
VALUES
    (91801, 'Recommended Test Item 01', 1.00, 'Good', NULL, 'Other', NULL, 'Recommended Test Hall', 'active', NULL, @marker),
    (91802, 'Recommended Test Item 02', 2.00, 'Good', NULL, 'Other', NULL, 'Recommended Test Hall', 'active', NULL, @marker),
    (91803, 'Recommended Test Item 03', 3.00, 'Good', NULL, 'Other', NULL, 'Recommended Test Hall', 'active', NULL, @marker),
    (91804, 'Recommended Test Item 04', 4.00, 'Good', NULL, 'Other', NULL, 'Recommended Test Hall', 'active', NULL, @marker),
    (91805, 'Recommended Test Item 05', 5.00, 'Good', NULL, 'Other', NULL, 'Recommended Test Hall', 'active', NULL, @marker),
    (91806, 'Recommended Test Item 06', 6.00, 'Good', NULL, 'Other', NULL, 'Recommended Test Hall', 'active', NULL, @marker),
    (91807, 'Recommended Test Item 07', 7.00, 'Good', NULL, 'Other', NULL, 'Recommended Test Hall', 'active', NULL, @marker),
    (91808, 'Recommended Test Item 08', 8.00, 'Good', NULL, 'Other', NULL, 'Recommended Test Hall', 'active', NULL, @marker),
    (91809, 'Recommended Test Item 09', 9.00, 'Good', NULL, 'Other', NULL, 'Recommended Test Hall', 'active', NULL, @marker),
    (91810, 'Recommended Test Item 10', 10.00, 'Good', NULL, 'Other', NULL, 'Recommended Test Hall', 'active', NULL, @marker),
    (91811, 'Recommended Test Item 11', 11.00, 'Good', NULL, 'Other', NULL, 'Recommended Test Hall', 'active', NULL, @marker),
    (91812, 'Recommended Test Item 12', 12.00, 'Good', NULL, 'Other', NULL, 'Recommended Test Hall', 'active', NULL, @marker),
    (91813, 'Recommended Test Item 13', 13.00, 'Good', NULL, 'Other', NULL, 'Recommended Test Hall', 'active', NULL, @marker),
    (91814, 'Recommended Test Item 14', 14.00, 'Good', NULL, 'Other', NULL, 'Recommended Test Hall', 'active', NULL, @marker),
    (91815, 'Recommended Test Item 15', 15.00, 'Good', NULL, 'Other', NULL, 'Recommended Test Hall', 'active', NULL, @marker),
    (91816, 'Recommended Test Item 16', 16.00, 'Good', NULL, 'Other', NULL, 'Recommended Test Hall', 'active', NULL, @marker),
    (91817, 'Recommended Test Item 17', 17.00, 'Good', NULL, 'Other', NULL, 'Recommended Test Hall', 'active', NULL, @marker),
    (91818, 'Recommended Sold Item', 18.00, 'Good', NULL, 'Other', NULL, 'Recommended Test Hall', 'sold', NULL, @marker),
    (91819, 'Recommended Hidden Item', 19.00, 'Good', NULL, 'Other', NULL, 'Recommended Test Hall', 'inactive', NULL, @marker),
    (91820, 'Recommended Own Item', 20.00, 'Good', NULL, 'Other', NULL, 'Recommended Test Hall', 'active', @user_id, @marker),
    (91821, 'Annex Test Item 1', 21.00, 'Good', NULL, 'Other', NULL, 'Recommended Test Annex', 'active', NULL, @marker),
    (91822, 'Annex Test Item 2', 22.00, 'Good', NULL, 'Other', NULL, 'Recommended Test Annex', 'active', NULL, @marker),
    (91823, 'Annex Test Item 3', 23.00, 'Good', NULL, 'Other', NULL, 'Recommended Test Annex', 'active', NULL, @marker);

-- Memberships of chun.recommend@test.com: member of all three, shopping only Recommended Test Hall
DELETE FROM community_join_requests WHERE user_id = @user_id AND community_id IN (91801, 91802, 91803);

UPDATE community_members SET shopping = 0 WHERE user_id = @user_id;

INSERT INTO community_members (user_id, community_id, shopping)
VALUES
    (@user_id, 91801, 1),
    (@user_id, 91802, 0),
    (@user_id, 91803, 0)
ON DUPLICATE KEY UPDATE shopping = VALUES(shopping);

-- Campus community (Karavan, legacy All of UB): member, not shopping
INSERT INTO community_members (user_id, community_id, shopping)
SELECT @user_id, id, 0 FROM admin_requests
 WHERE status = 'approved' AND LOWER(TRIM(business_name)) IN ('karavan', 'all of ub')
ON DUPLICATE KEY UPDATE shopping = 0;

-- Check: user found (not NULL) and the 3 communities approved
SELECT @user_id AS user_id;
SELECT id, business_name, status FROM admin_requests WHERE id IN (91801, 91802, 91803);
-- Check: 23 rows, all with the marker description (17 active Hall, then sold, inactive, own, 3 active Annex)
SELECT listing_id, name, price, community, status, owner_id, description FROM listings WHERE listing_id BETWEEN 91801 AND 91823;
-- Check: shopping = 1 only for community 91801
SELECT community_id, shopping FROM community_members WHERE user_id = @user_id;

-- Teardown (community_members rows are removed by their foreign keys):
-- DELETE FROM favorites WHERE listing_id BETWEEN 91801 AND 91823;
-- DELETE FROM listings WHERE listing_id BETWEEN 91801 AND 91823 AND description = 'Recommended items test item';
-- DELETE FROM admin_requests WHERE id IN (91801, 91802, 91803) AND email LIKE 'recommended-test-%@test.invalid';
