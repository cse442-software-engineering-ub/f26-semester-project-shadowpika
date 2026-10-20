-- Story #73 acceptance tests: two more items owned by chun.seller@test.com in All of UB, so Alternate Path
-- Tests 1 and 2 each request their own item (a buyer can have only one active request per item, and an
-- approval cannot be undone on the site). 91011 Discrete Math Textbook and 91012 Statistics Textbook start
-- with no meeting requests. Run after database/seeds/listings.sql and database/seeds/seller_meeting_requests.sql.
-- Safe to re-run: only listings 91011 and 91012 and the requests on them are touched.

INSERT IGNORE INTO listings (listing_id, name, price, `condition`, image_url, category, related_course, community, status) VALUES
    (91011, 'Discrete Math Textbook', 30.00, 'Good',     NULL, 'Textbooks', 'CSE 191', 'All of UB', 'active'),
    (91012, 'Statistics Textbook',    25.00, 'Like New', NULL, 'Textbooks', 'STA 119', 'All of UB', 'active');

SET @seller_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('chun.seller@test.com') LIMIT 1);

UPDATE listings SET owner_id = @seller_id, status = 'active', community = 'All of UB' WHERE listing_id IN (91011, 91012);

DELETE FROM meeting_requests WHERE listing_id IN (91011, 91012);

-- Check: should show 91011 Discrete Math Textbook and 91012 Statistics Textbook, both active, All of UB
SELECT listing_id, name, price, status, community FROM listings WHERE listing_id IN (91011, 91012);

-- Teardown (only when story #73's tests are no longer needed):
-- DELETE FROM meeting_requests WHERE listing_id IN (91011, 91012);
-- DELETE FROM listings WHERE listing_id IN (91011, 91012);
