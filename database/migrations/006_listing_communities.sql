-- Card #175: assign listings and approved meeting locations to an exact community name.
-- Safe to re-run. Export a database backup before applying this to a shared environment.

SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listings' AND COLUMN_NAME = 'community'
);
SET @migration_sql = IF(
    @column_exists = 0,
    'ALTER TABLE listings ADD COLUMN community VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL AFTER related_course',
    'SELECT 1'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'approved_locations' AND COLUMN_NAME = 'community'
);
SET @migration_sql = IF(
    @column_exists = 0,
    'ALTER TABLE approved_locations ADD COLUMN community VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL AFTER label',
    'SELECT 1'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @index_exists = (
    SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listings' AND INDEX_NAME = 'idx_listings_community'
);
SET @migration_sql = IF(
    @index_exists = 0,
    'ALTER TABLE listings ADD INDEX idx_listings_community (community)',
    'SELECT 1'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @index_exists = (
    SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'approved_locations' AND INDEX_NAME = 'idx_approved_locations_community'
);
SET @migration_sql = IF(
    @index_exists = 0,
    'ALTER TABLE approved_locations ADD INDEX idx_approved_locations_community (community)',
    'SELECT 1'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

-- Existing Sprint 2 QA data belongs to the approved All of UB community.
UPDATE listings
   SET community = 'All of UB'
 WHERE community IS NULL OR community = '';

UPDATE approved_locations
   SET community = 'All of UB'
 WHERE community IS NULL OR community = '';
