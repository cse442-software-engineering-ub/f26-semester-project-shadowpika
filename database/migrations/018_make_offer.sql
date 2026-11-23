-- #116: apply after 017_location_change_response.sql, in the verified application database after backup,
-- and before deploying the card #116 code.
-- Additive and re-runnable. listings.allow_offers: 1 = the seller accepts offers on the item, 0 = not
-- (every existing listing gets 0). meeting_requests.offer_price: the price the buyer offered, NULL when
-- the request has no offer (every existing request keeps NULL).
SET @allow_offers_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listings' AND COLUMN_NAME = 'allow_offers'
);
SET @make_offer_sql = IF(@allow_offers_exists = 0,
    'ALTER TABLE listings ADD COLUMN allow_offers TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE make_offer_statement FROM @make_offer_sql;
EXECUTE make_offer_statement;
DEALLOCATE PREPARE make_offer_statement;

SET @offer_price_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meeting_requests' AND COLUMN_NAME = 'offer_price'
);
SET @make_offer_sql = IF(@offer_price_exists = 0,
    'ALTER TABLE meeting_requests ADD COLUMN offer_price DECIMAL(10,2) NULL DEFAULT NULL', 'SELECT 1');
PREPARE make_offer_statement FROM @make_offer_sql;
EXECUTE make_offer_statement;
DEALLOCATE PREPARE make_offer_statement;
