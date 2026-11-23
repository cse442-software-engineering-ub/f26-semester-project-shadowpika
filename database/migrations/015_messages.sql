-- #12/#13: buyer-seller messages. Run after 014 in the application database.
-- Additive and re-runnable: the table is only created when missing, so an existing messages
-- table from the first prototype keeps its rows. User ids copy the users.id type so the
-- foreign keys work with legacy tables. Times are stored in UTC by the application.
SET @users_id_type = (
    SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'
);

SET @messages_sql = CONCAT(
    'CREATE TABLE IF NOT EXISTS messages (
        message_id  INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        sender_id   ', @users_id_type, ' NOT NULL,
        receiver_id ', @users_id_type, ' NOT NULL,
        listing_id  INT          NULL,
        message     TEXT         NOT NULL,
        position    INT UNSIGNED NOT NULL DEFAULT 1,
        `timestamp` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_messages_sender (sender_id),
        KEY idx_messages_receiver (receiver_id),
        KEY idx_messages_listing (listing_id),
        CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_messages_receiver FOREIGN KEY (receiver_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_messages_listing FOREIGN KEY (listing_id) REFERENCES listings (listing_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
);
PREPARE messages_statement FROM @messages_sql;
EXECUTE messages_statement;
DEALLOCATE PREPARE messages_statement;
