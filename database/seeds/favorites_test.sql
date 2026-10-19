-- Resets the favorites test account for the favorites task tests (card #118): deletes every favorite
-- saved by chun.buyer@test.com so it starts with none. Run after database/migrations/007_favorites.sql.
-- Safe to re-run: only that one user's favorites are touched.

DELETE FROM favorites
 WHERE user_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('chun.buyer@test.com') LIMIT 1);
