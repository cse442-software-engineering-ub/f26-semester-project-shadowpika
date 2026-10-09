-- Run once against cse442_2026_fall_team_j_db, after 003.
-- register.php now refuses duplicate emails, but the table itself never did, so older
-- duplicates may exist. This finds them; resolve each one (keep the real account) first:
--
--   SELECT LOWER(email) AS email, GROUP_CONCAT(CONCAT(id, ':', username, ':', role)) AS accounts
--   FROM users WHERE email IS NOT NULL GROUP BY LOWER(email) HAVING COUNT(*) > 1;
--
-- Once that returns no rows, this makes the database enforce it too. NULL emails are still allowed.

ALTER TABLE users ADD UNIQUE INDEX uq_users_email (email);
