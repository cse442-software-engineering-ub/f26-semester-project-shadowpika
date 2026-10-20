-- Makes "All of UB" an approved community (card #178). The test listings and the approved meeting locations
-- 91001-91003 belong to All of UB, and api/get_meeting_locations.php only answers for an approved community.
-- Run after database/migrations/006_listing_communities.sql. Safe to re-run: only admin_requests row 91070 is added.
-- Leaves the deliberately unapproved "all of ub" fixture (5029) alone. If id 91070 or the test email is already
-- used, inspect that row instead of overwriting it.

INSERT IGNORE INTO admin_requests (
    id, full_name, business_name, email, phone, password_hash,
    proof_file_name, proof_original_name, proof_mime_type, status,
    user_id, reviewed_by, reviewed_at
) VALUES (
    91070, 'All of UB Test Community', 'All of UB', 'all-of-ub-community@test.invalid',
    '000-000-0000', 'test-only-not-a-login-hash',
    'none', 'none.pdf', 'application/pdf', 'approved',
    NULL, NULL, NOW()
);

-- Check: should show 91070 | All of UB | approved
SELECT id, business_name, status FROM admin_requests WHERE id = 91070;

-- Teardown (only when All of UB is no longer needed; users who joined it keep community_id 91070):
-- DELETE FROM admin_requests WHERE id = 91070 AND email = 'all-of-ub-community@test.invalid';
