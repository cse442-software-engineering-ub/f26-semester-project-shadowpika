-- Read-only team preparation for #40 / #107.
-- Select the intended Aptitude or Cattle application database first.
-- The existing ordinary seller is deliberately preserved; never clear answers,
-- replace passwords, create users, or delete shared QA data to make this pass.
SELECT DATABASE() AS selected_database;

SELECT IF(
    COUNT(*) = 1
    AND SUM(CASE
        WHEN LOWER(email) = 'jia.seller@test.com'
         AND role = 'user'
         AND security_q1_index IS NULL
         AND security_a1_hash IS NULL
        THEN 1 ELSE 0 END) = 1,
    'READY: unique ordinary seller has no configured security answer',
    'BLOCKED: account is missing, ambiguous, has a different role or has recovery data'
) AS fixture_status
FROM users
WHERE LOWER(email) = 'jia.seller@test.com'
   OR LOWER(username) = 'jia.seller@test.com';
