-- Gives chun.buyer@test.com exactly two favorites for the remove-favorite task tests (card #180):
-- 91001 Calculus Textbook saved first, then 91002 Calculus Workbook, so the Favorites page lists
-- Calculus Workbook first and Calculus Textbook second.
-- Run after database/seeds/listings.sql and database/migrations/007_favorites.sql.
-- Safe to re-run: it first deletes that one user's favorites, then adds the two rows again.
-- Undo with database/seeds/favorites_test.sql.

SET @buyer_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('chun.buyer@test.com') LIMIT 1);

DELETE FROM favorites WHERE user_id = @buyer_id;

INSERT INTO favorites (user_id, listing_id) VALUES (@buyer_id, 91001);

INSERT INTO favorites (user_id, listing_id) VALUES (@buyer_id, 91002);
