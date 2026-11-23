-- #81/#232 read-only readiness. Select the intended application database first.
-- No account, listing, request, approval or check-in is created/reset here.
SELECT DATABASE() AS selected_database, @@hostname AS database_server;

-- Exactly one result for each test email is required; do not assume shared IDs.
SELECT email, COUNT(*) AS matches, MIN(id) AS user_id
FROM users
WHERE email IN ('jia.seller@test.com', 'jia.buyer@test.com')
GROUP BY email;

SELECT l.listing_id, u.id AS owner_id, u.email AS owner_email,
       l.name, l.price, l.status, l.meeting_location, l.meeting_location_id
FROM listings l JOIN users u ON u.id = l.owner_id
WHERE u.email = 'jia.seller@test.com'
ORDER BY l.listing_id;

-- meeting_date/time are New York wall time; check-in timestamps are stored UTC.
-- A protected meeting is Approved and either not past its +2h check-in close,
-- or has both check-ins. Preserve expired Approved and denied history.
SELECT r.request_id, r.listing_id, l.name, l.status AS listing_status,
       b.email AS buyer_email, r.status, r.meeting_date, r.meeting_time,
       r.checked_in_at, r.seller_checked_in_at
FROM meeting_requests r
JOIN listings l ON l.listing_id = r.listing_id
JOIN users s ON s.id = l.owner_id
JOIN users b ON b.id = r.buyer_id
WHERE s.email = 'jia.seller@test.com'
ORDER BY l.listing_id, r.request_id;
