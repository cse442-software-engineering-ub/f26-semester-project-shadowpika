-- Run on the intended application's database before deploying cards 106/107.
-- Add only missing q1 columns. Never replace existing answers or q2/q3 fields.
SET @has_q1 = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='security_q1_index');
SET @ddl = IF(@has_q1=0, 'ALTER TABLE users ADD COLUMN security_q1_index INT NULL', 'DO 0');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @has_a1 = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='security_a1_hash');
SET @ddl = IF(@has_a1=0, 'ALTER TABLE users ADD COLUMN security_a1_hash VARCHAR(255) NULL', 'DO 0');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
