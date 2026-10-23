-- Makes "Karavan" the campus-wide approved community (id 91070; formerly "All of UB").
-- Run after database/migrations/006_listing_communities.sql. Safe to re-run: only admin_requests row 91070 is added.
-- Leaves the deliberately unapproved "all of ub" fixture (5029) alone. If id 91070 is already
-- used, run 009_rename_all_of_ub_to_karavan.sql instead of overwriting it.

INSERT IGNORE INTO admin_requests (
    id, full_name, business_name, email, phone, password_hash,
    proof_file_name, proof_original_name, proof_mime_type, status,
    user_id, reviewed_by, reviewed_at
) VALUES (
    91070, 'Karavan Campus Community', 'Karavan', 'all-of-ub-community@test.invalid',
    '000-000-0000', 'test-only-not-a-login-hash',
    'none', 'none.pdf', 'application/pdf', 'approved',
    NULL, NULL, NOW()
);

-- Check: should show 91070 | Karavan | approved
SELECT id, business_name, status FROM admin_requests WHERE id = 91070;

-- Teardown:
-- DELETE FROM admin_requests WHERE id = 91070 AND email = 'all-of-ub-community@test.invalid';
