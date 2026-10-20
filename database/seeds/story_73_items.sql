-- Story #73 acceptance tests: two more items owned by chun.seller@test.com in All of UB, so Alternate Path
-- Tests 1 and 2 each request their own item (a buyer can have only one active request per item, and an
-- approval cannot be undone on the site). Discrete Math Textbook and Statistics Textbook start with no
-- meeting requests. Run after database/seeds/listings.sql and database/seeds/seller_meeting_requests.sql.
-- The rows get their own new ids and are found only by the marker description 'Story #73 test item', so this
-- script never touches any other listing. Safe to re-run.

SET @seller_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('chun.seller@test.com') LIMIT 1);

INSERT INTO listings (name, price, `condition`, image_url, category, related_course, community, status, owner_id, description)
SELECT 'Discrete Math Textbook', 30.00, 'Good', NULL, 'Textbooks', 'CSE 191', 'All of UB', 'active', @seller_id, 'Story #73 test item'
  FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM listings WHERE description = 'Story #73 test item' AND name = 'Discrete Math Textbook');

INSERT INTO listings (name, price, `condition`, image_url, category, related_course, community, status, owner_id, description)
SELECT 'Statistics Textbook', 25.00, 'Like New', NULL, 'Textbooks', 'STA 119', 'All of UB', 'active', @seller_id, 'Story #73 test item'
  FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM listings WHERE description = 'Story #73 test item' AND name = 'Statistics Textbook');

UPDATE listings SET owner_id = @seller_id, status = 'active', community = 'All of UB'
 WHERE description = 'Story #73 test item' AND name IN ('Discrete Math Textbook', 'Statistics Textbook');

DELETE FROM meeting_requests
 WHERE listing_id IN (SELECT listing_id FROM (SELECT listing_id FROM listings WHERE description = 'Story #73 test item') AS story_items);

-- Check: should show exactly Discrete Math Textbook and Statistics Textbook, both active, All of UB
SELECT listing_id, name, price, status, community FROM listings WHERE description = 'Story #73 test item';

-- Teardown (only when story #73's tests are no longer needed):
-- DELETE FROM meeting_requests WHERE listing_id IN (SELECT listing_id FROM (SELECT listing_id FROM listings WHERE description = 'Story #73 test item') AS story_items);
-- DELETE FROM listings WHERE description = 'Story #73 test item';
