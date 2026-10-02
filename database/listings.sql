-- Listings table used by api/search_listings.php, plus the test data the search tests rely on.
-- Safe to re-run: the table is only created if missing and the seed rows are upserted.

CREATE TABLE IF NOT EXISTS listings (
    listing_id  INT           NOT NULL AUTO_INCREMENT,
    name        VARCHAR(255)  NOT NULL,
    price       DECIMAL(10,2) NOT NULL,
    `condition` VARCHAR(50)   NOT NULL,
    image_url   VARCHAR(255)  DEFAULT NULL,
    category    VARCHAR(100)  NOT NULL DEFAULT 'Other',
    status      ENUM('active', 'sold', 'inactive') NOT NULL DEFAULT 'active',
    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (listing_id),
    KEY idx_listings_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Normalize category names left by earlier search/filter prototypes. These are the same values
-- accepted by the Create Listing flow and this statement is safe to run repeatedly.
UPDATE listings
   SET category = CASE category
       WHEN 'Books' THEN 'Textbooks'
       WHEN 'Electronics' THEN 'Tech & Electronics'
       WHEN 'Furniture' THEN 'Dorm Living'
       WHEN 'Clothing' THEN 'Clothing & Gear'
       ELSE category
   END
 WHERE category IN ('Books', 'Electronics', 'Furniture', 'Clothing');

INSERT INTO listings (listing_id, name, price, `condition`, image_url, category, status) VALUES
    (91001, 'Calculus Textbook',               35.00, 'Good',       'uploads/calculus-textbook.jpg',   'Textbooks',   'active'),
    (91002, 'Calculus Workbook',               20.00, 'Like New',   'uploads/calculus-workbook.jpg',   'Textbooks',   'active'),
    (91003, 'Desk Lamp',                       15.00, 'Good',       'uploads/desk-lamp.jpg',           'Dorm Living', 'active'),
    (91004, 'Calculus Notes',                   5.00, 'Fair',       'uploads/calculus-notes.jpg',      'Textbooks',   'sold'),
    (91005, 'Physical Chemistry',              60.00, 'Good',       'uploads/physical-chemistry.jpg',  'Textbooks',   'active'),
    (91006, 'Genetics: A Conceptual Approach', 45.00, 'Like New',   'uploads/genetics.jpg',            'Textbooks',   'active'),
    (91007, 'Campbell Biology',                55.00, 'Acceptable', 'uploads/campbell-biology.jpg',    'Textbooks',   'active'),
    (91008, 'Organic Chemistry Textbook',      50.00, 'Good',       'uploads/organic-chemistry.jpg',   'Textbooks',   'active'),
    (91009, 'Introduction to Algorithms',      40.00, 'Like New',   'uploads/intro-algorithms.jpg',    'Textbooks',   'active'),
    (91010, 'Dorm Fridge',                     80.00, 'Good',       'uploads/dorm-fridge.jpg',         'Dorm Living', 'active')
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    price = VALUES(price),
    `condition` = VALUES(`condition`),
    image_url = VALUES(image_url),
    category = VALUES(category),
    status = VALUES(status);
