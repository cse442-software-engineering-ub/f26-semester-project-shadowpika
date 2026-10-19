-- Resets the favorites test account for the favorites task tests (card #118): makes chun.buyer@test.com
-- the owner of 91010 Dorm Fridge (so saving it is refused as their own item) and deletes every favorite
-- saved by chun.buyer@test.com so it starts with none. Run after database/migrations/007_favorites.sql.
-- Needs listings.owner_id (database/schema/listings.sql).
-- Safe to re-run: only listing 91010 and that one user's favorites are touched.

SET @buyer_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('chun.buyer@test.com') LIMIT 1);

UPDATE listings SET owner_id = @buyer_id WHERE listing_id = 91010;

DELETE FROM favorites WHERE user_id = @buyer_id;
