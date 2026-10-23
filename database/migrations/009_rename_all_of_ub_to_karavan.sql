-- The campus-wide community is now named Karavan (same id 91070).
-- listings.community stores the exact business name, so both tables have to change together.
-- Safe to re-run.

UPDATE admin_requests
   SET business_name = 'Karavan',
       full_name = CASE
           WHEN full_name = 'All of UB Test Community' THEN 'Karavan Campus Community'
           ELSE full_name
       END
 WHERE id = 91070
    OR LOWER(TRIM(business_name)) = 'all of ub';

UPDATE listings
   SET community = 'Karavan'
 WHERE community = 'All of UB';

-- Check: 91070 should read Karavan
SELECT id, business_name, status FROM admin_requests WHERE id = 91070;
SELECT listing_id, name, community FROM listings WHERE community IN ('Karavan', 'All of UB') LIMIT 10;
