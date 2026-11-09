# Cards #221 / #222 / #223 — Multiple Listing Images

## Agreed behavior and interface

Each new listing has 1–5 JPEG/PNG/WebP files, up to 5 MB each. Selection order is
display order and the first image is the cover. Users can append/remove files
before publishing. Details show thumbnails and one selected large image. A failed
upload prevents publication and keeps the form retryable. First release does not
add post-publication gallery editing; ordinary listing edits preserve all images.

Reuse POST `listing/api/upload_image.php` (multipart field `image`). Upload each
file, then POST `listing/api/create_listing.php` with existing listing fields plus
ordered `image_urls:[url1,url2,...]` and `image_url:url1` for old clients.
Creation is 201; invalid image arrays/references are 422; missing auth is 401 and
nonmember access is 403. Every referenced image must be a valid existing local
image served by the current upload API, with 1–5 unique entries. Both supplied
cover/array fields must agree. Legacy create requests with image_url alone remain
accepted as one image.

Add `listing_images(listing_id,position,image_url)` with a composite primary key
and cascading listing deletion. Create listing and image rows in one transaction.
Both detail endpoints and My Listings return ordered `image_urls` while retaining
image_url. Old rows without gallery entries return `[image_url]` or `[]` when empty.
Ordinary edits do not rewrite the gallery. Multi-image cover replacement through
the old single-image editor is rejected explicitly; that picker is disabled for
multi-image listings. Existing single-image replacement remains usable.

## #221 — User Story

As a student selling an item, I want to upload several photos and let buyers view
them, which is confirmed by seeing every uploaded photo on the listing after it
is published and after refreshing the page.

### Test preparation

Use https://cattle.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/ after cards 222/223
and their migration are deployed. Prepare two dedicated ordinary accounts (seller
and buyer) joined to Karavan. Record their actual login details on the test-run
sheet; do not assume existing grading accounts. Prepare three visibly different
photos of one item, named `item-front.jpg`, `item-back.png`, `item-side.webp`, each
below 5 MB. Prepare a text file and a JPEG larger than 5 MB for invalid-file checks.
Use a new item title per test. Each test starts logged out and ends with both
accounts logged out and Email, Password and Log In visible. Do not reuse another
test's listing as a prerequisite.

### Happy Test 1 — Publish and view three photos

1. Log in as the prepared seller. Select Sell; on mobile open the navigation menu first.
2. Enter a unique title, category Textbooks, condition Good, price 25.00, community Karavan, an available approved meeting location and a description.
3. Upload front, back and side in that order. Verify all three previews and the first-photo cover label.
4. Select Create listing. Verify publication success and the listing card uses the front photo.
5. Log out; log in as the prepared buyer. Search for this exact title and open the listing.
6. Select each thumbnail. Verify the front, back and side photos match the seller's three uploads and remain on this one listing.
7. Refresh. Verify all three photos are still available and the first photo is initially selected. Log out.

### Happy Test 2 — Remove a selected photo before publishing

1. Log in as seller and start a separate valid listing with a unique title and the same required fields as Happy Test 1.
2. Select all three photos. Remove the front photo and verify only back and side remain, with back marked as the cover.
3. Publish. Open this listing and verify exactly back and side can be viewed. Refresh and verify both remain. Log out.

### Alt Test 1 — Invalid files and too many photos

1. Log in as seller; open Sell and fill a separate valid listing with a unique title.
2. Try uploading the text file, then the oversized JPEG. Verify a clear file error for each and no invalid preview.
3. Try selecting six valid images. Verify the five-photo limit is explained and six photos are not accepted.
4. Correct the selection to three valid photos; verify all previews are available and the form remains editable. Cancel without publishing. Log out.

### Alt Test 2 — Ordinary edits retain every image

1. Log in as seller and publish a separate three-photo listing using the required fields from Happy Test 1.
2. Open My Listings → Edit for this item. Change only its description and save.
3. Open its detail page, select every thumbnail and refresh. Verify the new description and all three original photos remain. Log out.

### Alt Test 3 — Existing single-photo listing

1. Log in as buyer. Use a dedicated preexisting single-photo fixture recorded in the run sheet.
2. Open it and verify its original photo is visible, with no empty extra thumbnails. Refresh and verify the photo remains. Log out.
3. If the prepared fixture is unavailable, record the missing setup; do not claim this case passed.

## #222 — Frontend: Multiple Image Selection and Detail Gallery

Use Aptitude https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/.
Frontend automated tests use intercepted fetch responses and require no real
listing mutations. From frontend run
`node node_modules/vitest/vitest.mjs run src/__tests__/CreateListing.test.jsx src/__tests__/ListingGallery.test.jsx src/__tests__/ManageListings.test.jsx`.
Each automated case resets mocks and storage independently.

### Test 1 — Select, append, remove and validate

1. Run the multi-image cases in CreateListing.test.jsx independently.
2. Verify one selection plus a later selection appends files in order; every accepted file has a preview/removal control.
3. Remove the first file; verify the next one becomes cover. Remove all files and submit; verify no create request and Item photo is required.
4. Verify sixth-file, unsupported MIME, empty-file and over-5-MB selections are rejected without dropping previously valid selections.

### Test 2 — Upload contract, failure and retry

1. Run the publication/failure cases in CreateListing.test.jsx with its mocked community, location and upload responses.
2. Each file sends one multipart POST upload_image.php with field image. Successful upload responses are `{"success":true,"image_url":"listing/api/image.php?file=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg"}` and a second response with 32 b characters instead of a.
3. Only after all uploads succeed is create_listing.php sent; its JSON includes the ordered image_urls and the first image_url.
4. Mock a later upload failure `{"success":false,"error":"Upload failed."}`. Verify no create request, visible error and retained form/files. Retry; already successful uploads are reused and only one listing creation is sent. Pending publication disables controls.

### Test 3 — Gallery switching and legacy fallback

1. Run ListingGallery.test.jsx. Supply images `['front.jpg','back.png','side.webp']` and cover front.jpg.
2. Verify first image initially, each thumbnail changes the large image and selected state, and keyboard activation works.
3. Re-render with a different listing/array and verify the first image is selected. Re-render with image_url only and verify one image with no extra thumbnails.
4. Fail one large-image load; verify a placeholder and that selecting another thumbnail still works.

### Test 4 — Phone layout and ordinary editing

1. On Aptitude, with an independently prepared logged-in test session, inspect Sell and a prepared multi-image detail page at 390 × 844.
2. Verify previews, remove controls and thumbnails are visible without horizontal page scrolling; Tab/Enter operate the gallery.
3. Run the mocked ManageListings test to verify saving text sends no gallery replacement and the old single-image picker is disabled for a gallery.
4. Restore the viewport. This manual visual inspection does not establish backend persistence.

## #223 — Backend: Persist and Return Multiple Listing Images

Use direct API requests on Aptitude with an isolated prepared seller account and
fresh listing per case. Use POST login.php to establish its cookie jar; use a
separate buyer/nonmember jar for read permissions. POST logout.php afterward and
clear jars. Do not modify shared grading fixtures. Apply the migration first.

### Test 1 — Upload, create and retrieve in order

1. Login directly. POST each of the three fixture files separately to listing/api/upload_image.php as multipart image; expect 201, success true and image_url.
2. POST listing/api/create_listing.php with a unique title, valid category/condition/price/community/location/description and the three returned URLs in image_urls. Also send image_url equal to the first URL.
3. Expect 201 and a listing with those image_urls in the same order and image_url equal to the first.
4. GET listing/api/get_listing.php?listing_id=ID and api/get_item_details.php?listing_id=ID in authorized sessions; expect 200 and the same ordered images. Log out.

### Test 2 — Reject invalid galleries without inserting a listing

1. Login directly with this test's fresh session and upload one valid image.
2. For separate unique titles POST create with image_urls empty, six URLs, duplicate URLs, a nonarray, a nonstring element, an external URL, a traversal URL, a missing local file and a cover differing from the first image.
3. Expect 422 / success false for every case. Verify no matching listing through direct retrieval/test database assertions. Log out.

### Test 3 — Authorization and normal-edit compatibility

1. Create a new three-image listing as seller, then POST its ordinary description change through update_listing.php. Expect 200.
2. Re-read through both detail endpoints: the description changed and all image rows/cover remain.
3. A different user cannot edit it; an unauthenticated request cannot create it. A logged-in nonmember cannot read it. Verify 403/401/403 respectively and unchanged data. Log out all jars.

### Test 4 — Migration, transaction rollback and legacy compatibility

1. Run `php tests/mysql/listing_images_test.php` against a disposable loopback MySQL using KARAVAN_IMAGE_TEST_DSN, never an online database.
2. Verify migration rerun preserves old listing IDs/image_url values and new gallery order; a forced gallery-row failure rolls back both listing and image rows.
3. Verify a legacy single-image create/read still works, a listing with no image returns an empty gallery, and deleting a listing cascades only its image associations.
4. Verify all temporary database, session and uploaded test fixtures are cleaned up by the script. Online Cattle acceptance remains pending deployment.
