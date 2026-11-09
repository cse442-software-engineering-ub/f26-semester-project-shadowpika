# Card 223 — deployment and verification

Apply `database/migrations/016_listing_images.sql` to the intended database before
deploying cards 222/223. It requires the existing InnoDB listings table with signed
INT listing_id. It is rerunnable and does not backfill or overwrite old covers.
Read compatibility supplies an image_urls array for legacy single/no-image rows.

Card 222's `docs/multiple-listing-images-cards.md` contains all three revised
cards and the interface contract. A nonowner edit follows the existing HTTP 404
not-found contract; unauthenticated create is 401 and nonmember reads are 403.

Build release, then run `php vendor/bin/phpunit --filter
'ListingImages|ManageListingsTest|CommunityListingTest|ListingLocationsTest|ItemDetailsHttpTest'`.
Set KARAVAN_IMAGE_TEST_DSN to a disposable loopback MySQL DSN, e.g.
`mysql:host=127.0.0.1;port=33341`, and run `php tests/mysql/listing_images_test.php`.
It uses real multipart uploads, PHP endpoints, PDO/mysqli, random temporary DB and
user, isolated sessions and deterministic rollback injection. It cleans up its
own uploaded files and fixtures. Never point it at Aptitude/Cattle.

Uploads are staged individually using the existing endpoint. If listing creation
fails, it creates no partial listing/gallery rows. Previously staged upload files
remain available for retry; automated global orphan-file collection is outside
this change. Deleting a listing removes associations, not potentially shared files.

## Local validation (2026-11-09)

- 28 targeted PHP unit/HTTP tests, 141 assertions passed.
- 55 real MySQL/HTTP checks passed, including the five-image boundary.
- All 33 existing MySQL listing-access regression checks passed.
- Build/manifest verification and all six release regression checks passed.
- Full-suite baseline limitations are documented in card 107's backend notes:
  three ConfigTest duplicate-constant errors and two moderator HTTP assertions.
  These reproduced on unchanged dev eea5052; they are not reported as passes.
