-- Adds a favorite for chun.buyer@test.com on 91004 Calculus Notes (a sold listing) so the favorites
-- task tests (card #118, Test 6) can check that sold items are left out of the list.
-- Run after database/seeds/listings.sql and database/migrations/007_favorites.sql.
-- Safe to re-run: the unique (user_id, listing_id) key makes INSERT IGNORE add the row only once.
-- Undo with database/seeds/favorites_test.sql.

INSERT IGNORE INTO favorites (user_id, listing_id)
SELECT id, 91004 FROM users WHERE LOWER(email) = LOWER('chun.buyer@test.com') LIMIT 1;
