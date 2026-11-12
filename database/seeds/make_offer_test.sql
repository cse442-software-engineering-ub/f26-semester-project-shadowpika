-- Make offer QA fixture (card #116): four listings of david.seller@test.com with the marker description
-- 'Make offer test item'. Offer Allowed Item (25.00, offers allowed), Offer Not Allowed Item (25.00, offers not allowed),
-- Offer Cents Item (12.34, offers allowed), Offer Edit Item (30.00, offers not allowed).
-- Run after database/migrations/018_make_offer.sql (and the earlier migrations, including 011 and 016).
-- david.seller@test.com must already be registered, and Karavan needs at least one approved meeting location.
-- Safe to re-run, and every test run ends with it: there are no fixed ids, the first run inserts the four listings and
-- later runs update them in place by owner + marker + name, so their ids stay the same.
-- Each run also removes all purchase requests on the four listings and every other listing of david.seller@test.com
-- with the marker description (for example the listings a test creates).
-- Every DELETE and UPDATE is scoped to the owner david.seller@test.com AND the marker description.
-- Undo everything with database/seeds/make_offer_teardown.sql.

SET @seller_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('david.seller@test.com') LIMIT 1);
SET @location_id = (SELECT id FROM approved_locations WHERE community = 'Karavan' ORDER BY id LIMIT 1);
SET @location_label = (SELECT label FROM approved_locations WHERE id = @location_id);

-- The marker is written out here: comparing the column with a variable fails on the team DB (#1267, mixed collations).
-- Purchase requests on the four listings
DELETE r FROM meeting_requests r
  JOIN listings l ON l.listing_id = r.listing_id
 WHERE l.owner_id = @seller_id AND l.description = 'Make offer test item'
   AND l.name IN ('Offer Allowed Item', 'Offer Not Allowed Item', 'Offer Cents Item', 'Offer Edit Item');

-- Other marker listings of the seller (their photos and requests go with them)
DELETE FROM listings
 WHERE owner_id = @seller_id AND description = 'Make offer test item'
   AND name NOT IN ('Offer Allowed Item', 'Offer Not Allowed Item', 'Offer Cents Item', 'Offer Edit Item');

-- Put the four listings back to their values
UPDATE listings
   SET price = 25.00, allow_offers = 1, `condition` = 'Good', image_url = './assets/images/meeting-test-item.png',
       category = 'Other', related_course = NULL, community = 'Karavan', status = 'active',
       meeting_location = @location_label, meeting_location_id = @location_id
 WHERE owner_id = @seller_id AND description = 'Make offer test item' AND name = 'Offer Allowed Item';
UPDATE listings
   SET price = 25.00, allow_offers = 0, `condition` = 'Good', image_url = './assets/images/meeting-test-item.png',
       category = 'Other', related_course = NULL, community = 'Karavan', status = 'active',
       meeting_location = @location_label, meeting_location_id = @location_id
 WHERE owner_id = @seller_id AND description = 'Make offer test item' AND name = 'Offer Not Allowed Item';
UPDATE listings
   SET price = 12.34, allow_offers = 1, `condition` = 'Good', image_url = './assets/images/meeting-test-item.png',
       category = 'Other', related_course = NULL, community = 'Karavan', status = 'active',
       meeting_location = @location_label, meeting_location_id = @location_id
 WHERE owner_id = @seller_id AND description = 'Make offer test item' AND name = 'Offer Cents Item';
UPDATE listings
   SET price = 30.00, allow_offers = 0, `condition` = 'Good', image_url = './assets/images/meeting-test-item.png',
       category = 'Other', related_course = NULL, community = 'Karavan', status = 'active',
       meeting_location = @location_label, meeting_location_id = @location_id
 WHERE owner_id = @seller_id AND description = 'Make offer test item' AND name = 'Offer Edit Item';

-- Insert the ones that do not exist yet (first run only)
INSERT INTO listings (owner_id, name, price, `condition`, image_url, category, related_course, community, status, meeting_location, meeting_location_id, description, allow_offers)
SELECT @seller_id, 'Offer Allowed Item', 25.00, 'Good', './assets/images/meeting-test-item.png', 'Other', NULL, 'Karavan', 'active', @location_label, @location_id, 'Make offer test item', 1
  FROM DUAL
 WHERE @seller_id IS NOT NULL AND @location_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM listings WHERE owner_id = @seller_id AND description = 'Make offer test item' AND name = 'Offer Allowed Item');
INSERT INTO listings (owner_id, name, price, `condition`, image_url, category, related_course, community, status, meeting_location, meeting_location_id, description, allow_offers)
SELECT @seller_id, 'Offer Not Allowed Item', 25.00, 'Good', './assets/images/meeting-test-item.png', 'Other', NULL, 'Karavan', 'active', @location_label, @location_id, 'Make offer test item', 0
  FROM DUAL
 WHERE @seller_id IS NOT NULL AND @location_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM listings WHERE owner_id = @seller_id AND description = 'Make offer test item' AND name = 'Offer Not Allowed Item');
INSERT INTO listings (owner_id, name, price, `condition`, image_url, category, related_course, community, status, meeting_location, meeting_location_id, description, allow_offers)
SELECT @seller_id, 'Offer Cents Item', 12.34, 'Good', './assets/images/meeting-test-item.png', 'Other', NULL, 'Karavan', 'active', @location_label, @location_id, 'Make offer test item', 1
  FROM DUAL
 WHERE @seller_id IS NOT NULL AND @location_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM listings WHERE owner_id = @seller_id AND description = 'Make offer test item' AND name = 'Offer Cents Item');
INSERT INTO listings (owner_id, name, price, `condition`, image_url, category, related_course, community, status, meeting_location, meeting_location_id, description, allow_offers)
SELECT @seller_id, 'Offer Edit Item', 30.00, 'Good', './assets/images/meeting-test-item.png', 'Other', NULL, 'Karavan', 'active', @location_label, @location_id, 'Make offer test item', 0
  FROM DUAL
 WHERE @seller_id IS NOT NULL AND @location_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM listings WHERE owner_id = @seller_id AND description = 'Make offer test item' AND name = 'Offer Edit Item');

-- Each of the four listings has the photo as its only gallery image (position 0)
DELETE FROM listing_images
 WHERE listing_id IN (SELECT listing_id FROM listings WHERE owner_id = @seller_id AND description = 'Make offer test item');
INSERT INTO listing_images (listing_id, `position`, image_url)
SELECT listing_id, 0, './assets/images/meeting-test-item.png'
  FROM listings
 WHERE owner_id = @seller_id AND description = 'Make offer test item';

-- Check: 4 rows, the values from the header, meeting_location_id and meeting_location of the first approved Karavan location
SELECT l.listing_id, l.name, l.price, l.allow_offers, l.status, l.community, l.meeting_location_id, l.meeting_location, l.image_url
  FROM listings l JOIN users u ON u.id = l.owner_id
 WHERE LOWER(u.email) = 'david.seller@test.com' AND l.description = 'Make offer test item'
 ORDER BY l.name;
-- Check: 4 rows, one photo each
SELECT i.listing_id, i.`position`, i.image_url
  FROM listing_images i JOIN listings l ON l.listing_id = i.listing_id JOIN users u ON u.id = l.owner_id
 WHERE LOWER(u.email) = 'david.seller@test.com' AND l.description = 'Make offer test item'
 ORDER BY i.listing_id;
-- Check: no rows (no purchase requests on these listings)
SELECT r.request_id, r.listing_id
  FROM meeting_requests r JOIN listings l ON l.listing_id = r.listing_id JOIN users u ON u.id = l.owner_id
 WHERE LOWER(u.email) = 'david.seller@test.com' AND l.description = 'Make offer test item';
