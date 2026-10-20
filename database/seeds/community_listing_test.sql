-- Card #175 QA fixture. This deliberately similar, unapproved name proves that
-- matching is exact and that pending partner requests never become selectable communities.
-- If id 5029 or the test email is already used, inspect that row instead of overwriting it.

INSERT IGNORE INTO admin_requests (
    id, full_name, business_name, email, phone, password_hash,
    proof_file_name, proof_original_name, proof_mime_type, status,
    user_id, reviewed_by, reviewed_at
) VALUES (
    5029, 'Unapproved All of UB Test', 'all of ub', 'unapproved-all-of-ub@test.invalid',
    '000-000-0000', 'test-only-not-a-login-hash',
    'none', 'none.pdf', 'application/pdf', 'pending',
    NULL, NULL, NULL
);
