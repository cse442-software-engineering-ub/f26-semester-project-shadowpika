-- Listings table used by api/search_listings.php, plus the test data the search tests rely on.
-- Safe to re-run: the table is only created if missing and the seed rows are upserted.

CREATE TABLE IF NOT EXISTS listings (
    listing_id  INT           NOT NULL AUTO_INCREMENT,
    name        VARCHAR(255)  NOT NULL,
    price       DECIMAL(10,2) NOT NULL,
    `condition` VARCHAR(50)   NOT NULL,
    image_url   VARCHAR(255)  DEFAULT NULL,
    category    VARCHAR(100)  NOT NULL DEFAULT 'Other',
    related_course VARCHAR(100) DEFAULT NULL,
    status      ENUM('active', 'sold', 'inactive') NOT NULL DEFAULT 'active',
    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (listing_id),
    KEY idx_listings_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add only missing fixtures. Existing rows are deliberately left unchanged because the shared
-- development database can contain listings created by other task cards and testers.
INSERT IGNORE INTO listings (listing_id, name, price, `condition`, image_url, category, related_course, status) VALUES
    (91001, 'Calculus Textbook',               35.00, 'Good',       'uploads/calculus-textbook.jpg',   'Textbooks',   'MTH 141', 'active'),
    (91002, 'Calculus Workbook',               20.00, 'Like New',   'uploads/calculus-workbook.jpg',   'Textbooks',   'MTH 142', 'active'),
    (91003, 'Desk Lamp',                       15.00, 'Good',       'uploads/desk-lamp.jpg',           'Dorm Living', NULL,      'active'),
    (91004, 'Calculus Notes',                   5.00, 'Fair',       'uploads/calculus-notes.jpg',      'Textbooks',   'MTH 141', 'sold'),
    (91005, 'Physical Chemistry',              60.00, 'Good',       'uploads/physical-chemistry.jpg',  'Textbooks',   'CHE 203', 'active'),
    (91006, 'Genetics: A Conceptual Approach', 45.00, 'Like New',   'uploads/genetics.jpg',            'Textbooks',   'BIO 201', 'active'),
    (91007, 'Campbell Biology',                55.00, 'Acceptable', 'uploads/campbell-biology.jpg',    'Textbooks',   'BIO 200', 'active'),
    (91008, 'Organic Chemistry Textbook',      50.00, 'Good',       'uploads/organic-chemistry.jpg',   'Textbooks',   'CHE 201', 'active'),
    (91009, 'Introduction to Algorithms',      40.00, 'Like New',   'uploads/intro-algorithms.jpg',    'Textbooks',   'CSE 331', 'active'),
    (91010, 'Dorm Fridge',                     80.00, 'Good',       'uploads/dorm-fridge.jpg',         'Dorm Living', NULL,      'active');

-- Older copies of these fixtures predate related-course search. Fill only missing fixture values;
-- never replace a course someone has already assigned in the shared development database.
UPDATE listings
   SET related_course = CASE listing_id
       WHEN 91001 THEN 'MTH 141'
       WHEN 91002 THEN 'MTH 142'
       WHEN 91004 THEN 'MTH 141'
       WHEN 91005 THEN 'CHE 203'
       WHEN 91006 THEN 'BIO 201'
       WHEN 91007 THEN 'BIO 200'
       WHEN 91008 THEN 'CHE 201'
       WHEN 91009 THEN 'CSE 331'
       ELSE related_course
   END
 WHERE listing_id IN (91001, 91002, 91004, 91005, 91006, 91007, 91008, 91009)
   AND related_course IS NULL;
