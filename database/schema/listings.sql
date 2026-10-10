-- Creates the listing table for a new environment and adds the fields required
-- by the create-listing flow when the search task already created the table.

CREATE TABLE IF NOT EXISTS listings (
    listing_id       INT           NOT NULL AUTO_INCREMENT,
    owner_id         INT           DEFAULT NULL,
    name             VARCHAR(255)  NOT NULL,
    price            DECIMAL(10,2) NOT NULL,
    `condition`      VARCHAR(50)   NOT NULL,
    image_url        VARCHAR(255)  DEFAULT NULL,
    category         VARCHAR(100)  NOT NULL DEFAULT 'Other',
    related_course   VARCHAR(100)  DEFAULT NULL,
    meeting_location VARCHAR(150)  DEFAULT NULL,
    description      TEXT          NULL,
    status           ENUM('active', 'sold', 'inactive') NOT NULL DEFAULT 'active',
    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (listing_id),
    KEY idx_listings_status (status),
    KEY idx_listings_owner_status (owner_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listings' AND COLUMN_NAME = 'owner_id'
);
SET @migration_sql = IF(
    @column_exists = 0,
    'ALTER TABLE listings ADD COLUMN owner_id INT DEFAULT NULL AFTER listing_id',
    'SELECT 1'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listings' AND COLUMN_NAME = 'related_course'
);
SET @migration_sql = IF(
    @column_exists = 0,
    'ALTER TABLE listings ADD COLUMN related_course VARCHAR(100) DEFAULT NULL AFTER category',
    'SELECT 1'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listings' AND COLUMN_NAME = 'meeting_location'
);
SET @migration_sql = IF(
    @column_exists = 0,
    'ALTER TABLE listings ADD COLUMN meeting_location VARCHAR(150) DEFAULT NULL AFTER related_course',
    'SELECT 1'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listings' AND COLUMN_NAME = 'description'
);
SET @migration_sql = IF(
    @column_exists = 0,
    'ALTER TABLE listings ADD COLUMN description TEXT NULL AFTER meeting_location',
    'SELECT 1'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listings' AND COLUMN_NAME = 'updated_at'
);
SET @migration_sql = IF(
    @column_exists = 0,
    'ALTER TABLE listings ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
    'SELECT 1'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @index_exists = (
    SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listings' AND INDEX_NAME = 'idx_listings_owner_status'
);
SET @migration_sql = IF(
    @index_exists = 0,
    'ALTER TABLE listings ADD INDEX idx_listings_owner_status (owner_id, status)',
    'SELECT 1'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;
