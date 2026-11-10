-- Apply before deploying cards 222/223. Existing single-image rows stay intact.
-- Matches listings.listing_id INT (signed) in the shared schema.
CREATE TABLE IF NOT EXISTS listing_images (
    listing_id INT NOT NULL,
    `position` TINYINT UNSIGNED NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    PRIMARY KEY (listing_id, `position`),
    UNIQUE KEY uq_listing_image_url (listing_id, image_url),
    CONSTRAINT fk_listing_images_listing FOREIGN KEY (listing_id)
        REFERENCES listings (listing_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
