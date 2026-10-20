-- Sets up the seller meeting request response task tests (cards #177 and #178): makes chun.seller@test.com
-- the owner of listings 91005, 91006, 91008 and 91009, and gives chun.buyer@test.com pending requests
-- 91061 (on 91006), 91062 (on 91008) and 91063 (on 91009). Listing 91005 starts with no requests.
-- Run after database/seeds/listings.sql and database/migrations/meeting_requests.sql.
-- Safe to re-run: only listings 91005, 91006, 91008, 91009 and requests 91061-91063 are touched.

SET @seller_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('chun.seller@test.com') LIMIT 1);
SET @buyer_id  = (SELECT id FROM users WHERE LOWER(email) = LOWER('chun.buyer@test.com') LIMIT 1);

UPDATE listings SET owner_id = @seller_id WHERE listing_id IN (91005, 91006, 91008, 91009);

DELETE FROM meeting_requests WHERE listing_id IN (91005, 91006, 91008, 91009) OR request_id IN (91061, 91062, 91063);

INSERT INTO meeting_requests (request_id, buyer_id, listing_id, meeting_date, meeting_time, location_id, location_label, status) VALUES
    (91061, @buyer_id, 91006, '2026-12-11', '13:00:00', 91001, 'Capen Hall Main Entrance', 'pending'),
    (91062, @buyer_id, 91008, '2026-12-12', '15:30:00', 91002, 'Student Union Main Entrance', 'pending'),
    (91063, @buyer_id, 91009, '2026-12-14', '11:00:00', 91003, 'Lockwood Memorial Library Main Entrance', 'pending');

-- Teardown (run after the tests):
-- DELETE FROM meeting_requests WHERE listing_id IN (91005, 91006, 91008, 91009) OR request_id IN (91061, 91062, 91063);
-- UPDATE listings SET owner_id = NULL WHERE listing_id IN (91005, 91006, 91008, 91009) AND owner_id = @seller_id;
