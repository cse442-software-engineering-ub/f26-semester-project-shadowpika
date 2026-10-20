-- Community shopping QA fixture: two approved test communities with one active item each.
-- Run after database/migrations/008_community_members.sql and database/seeds/all_of_ub_community.sql.
-- Safe to re-run. If ids 91080/91081 or 95001/95002 are already used, inspect those rows instead of overwriting them.

INSERT IGNORE INTO admin_requests (
    id, full_name, business_name, email, phone, password_hash,
    proof_file_name, proof_original_name, proof_mime_type, status,
    user_id, reviewed_by, reviewed_at
) VALUES
    (91080, 'Shopping Test Hall', 'Shopping Test Hall', 'shopping-test-hall@test.invalid',
     '000-000-0000', 'test-only-not-a-login-hash', 'none', 'none.pdf', 'application/pdf', 'approved',
     NULL, NULL, NOW()),
    (91081, 'Shopping Test Annex', 'Shopping Test Annex', 'shopping-test-annex@test.invalid',
     '000-000-0000', 'test-only-not-a-login-hash', 'none', 'none.pdf', 'application/pdf', 'approved',
     NULL, NULL, NOW());

INSERT IGNORE INTO listings (listing_id, name, price, `condition`, image_url, category, related_course, community, status, owner_id, description)
VALUES
    (95001, 'Hall Test Lamp', 12.00, 'Good', NULL, 'Dorm Living', NULL, 'Shopping Test Hall', 'active', NULL, 'Community shopping test item'),
    (95002, 'Annex Test Kettle', 18.00, 'Like New', NULL, 'Dorm Living', NULL, 'Shopping Test Annex', 'active', NULL, 'Community shopping test item');

-- Check: should show both communities as approved and both items as active
SELECT id, business_name, status FROM admin_requests WHERE id IN (91080, 91081);
SELECT listing_id, name, community, status FROM listings WHERE listing_id IN (95001, 95002);

-- Teardown (community_members and meeting_requests rows for these ids are removed by their foreign keys):
-- DELETE FROM favorites WHERE listing_id IN (95001, 95002);
-- DELETE FROM listings WHERE listing_id IN (95001, 95002) AND description = 'Community shopping test item';
-- DELETE FROM admin_requests WHERE id IN (91080, 91081) AND email LIKE 'shopping-test-%@test.invalid';
