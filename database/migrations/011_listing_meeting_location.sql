-- #203: persist the approved meeting spot selected by the seller.
-- Export a backup first. Run in the application database AFTER listings and
-- approved_locations exist. Re-runnable; does not create or rename communities.

SET @location_id_type = (
    SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'approved_locations' AND COLUMN_NAME = 'id'
);
SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listings' AND COLUMN_NAME = 'meeting_location_id'
);
SET @migration_sql = IF(@column_exists = 0,
    CONCAT('ALTER TABLE listings ADD COLUMN meeting_location_id ', @location_id_type, ' NULL AFTER meeting_location'),
    'SELECT 1');
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @index_exists = (
    SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listings' AND COLUMN_NAME = 'meeting_location_id' AND SEQ_IN_INDEX = 1
);
SET @migration_sql = IF(@index_exists = 0,
    'ALTER TABLE listings ADD INDEX idx_listings_meeting_location (meeting_location_id)', 'SELECT 1');
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @foreign_key_exists = (
    SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listings' AND COLUMN_NAME = 'meeting_location_id'
       AND REFERENCED_TABLE_NAME = 'approved_locations' AND REFERENCED_COLUMN_NAME = 'id'
);
SET @migration_sql = IF(@foreign_key_exists = 0,
    'ALTER TABLE listings ADD CONSTRAINT fk_listings_meeting_location FOREIGN KEY (meeting_location_id) REFERENCES approved_locations (id) ON DELETE SET NULL',
    'SELECT 1');
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

-- HEX grouping and BINARY comparison avoid case/trailing-space collation matches.
-- Duplicate labels within one community remain unresolved even if one has bad coordinates.
UPDATE listings AS listing
JOIN (
    SELECT MIN(id) AS location_id
      FROM approved_locations
     GROUP BY HEX(label), HEX(community)
    HAVING COUNT(*) = 1
) AS unique_location ON 1 = 1
JOIN approved_locations AS location ON location.id = unique_location.location_id
   AND BINARY location.label = BINARY listing.meeting_location
   AND BINARY location.community = BINARY listing.community
SET listing.meeting_location_id = location.id
WHERE listing.meeting_location_id IS NULL
  AND TRIM(location.label) <> '' AND TRIM(location.community) <> ''
  AND location.lat BETWEEN -90 AND 90 AND location.lng BETWEEN -180 AND 180;

-- Unmatched records intentionally retain their text without a map pin.
SELECT listing_id, name, community, meeting_location
  FROM listings
 WHERE meeting_location_id IS NULL AND meeting_location IS NOT NULL;
