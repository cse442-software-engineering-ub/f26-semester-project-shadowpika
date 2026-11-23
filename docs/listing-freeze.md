# #81 / #232 — Freeze and restore listings

Backend for #81; the Manage Listings controls and disabled meeting-location field
are the separate #231 frontend task. No database migration is required.

## #231 frontend behavior

Manage Listings now has View Active, View Sold and **View Paused**, with **Freeze
All Listings** aligned right on the desktop toolbar; mobile controls wrap. The
button is disabled when no item is eligible, while loading/mutating, after a load
failure, or when backend eligibility metadata is missing/inconsistent. Reloading
authoritative data is required before a failed/uncertain mutation can enable it.

The confirmation explains protected meetings and request cancellation. **Keep
Listings**, the close control and Escape send no mutation. Initial focus goes to
Keep Listings; Tab/Shift+Tab stay in the dialog. While submitting, controls and
Escape dismissal are protected. On close, focus returns to the trigger or the
Paused control if the trigger is disabled. Successful freezing shows the server's
three counts and opens View Paused. A stale earlier poll cannot undo that result.

Each paused item shows **Paused** rather than the stored `inactive` value, and
**Mark as available** sends `action: resume` for that one ID. The UI waits for
server success, then rereads listings and opens View Active. Existing Sold,
ordinary edit and gallery behavior are retained. This task adds only the freeze
confirmation; other action-confirmation stories remain separate.

Organize a Meet keeps the seller's location read-only and actually **disabled**,
with a light grey background and dark text at full opacity. Keyboard navigation
skips it. The create-request JSON still uses the saved location ID, independent
of native disabled-input form serialization.

From `frontend/`, run the related frontend tests:

```text
npm test -- src/__tests__/ListingFreeze.test.jsx src/__tests__/ManageListings.test.jsx src/__tests__/MeetingRequests.test.jsx
```

`ListingFreeze.test.jsx` mocks APIs independently of PHP and supplies jsdom's
missing dialog methods. Real keyboard/modal behavior and desktop/mobile rendering
were additionally checked in an isolated Chromium + PHP/MySQL integration flow.

## Rules

- Persist Paused as the existing `inactive` listing status. Only the signed-in
  owner's Active listings are considered. Newly published items are not
  automatically paused.
- Skip an entire item if any Approved meeting is still within its existing
  check-in window (inclusive closing instant, meeting time +2 hours in
  America/New_York), or if both participants checked in to the same Approved
  meeting and the listing has not been marked Sold. The latter remains protected
  after the window ends. The existing check-in calculation is shared, not copied.
- An expired Approved meeting with fewer than two check-ins does not block a
  pause. Its history/timestamps, and denied history, remain unchanged.
- For each item actually frozen, delete Pending and unanswered
  `location_change_requested` requests using the existing cancellation model.
  They disappear from both request lists. Skipped items keep all their requests.
- Resume one owned item at a time. Canceled requests are never recreated.
  Sold, pre-existing Paused items and other sellers are unaffected by Freeze All.

## API contract

Use the existing authenticated `POST /listing/api/update_listing.php` JSON endpoint.
The session supplies the owner; a caller-supplied owner ID cannot select a seller.

```json
{"action":"freeze_all"}
```

HTTP 200, for example:

```json
{"success":true,"frozen_count":3,"skipped_count":2,"cancelled_request_count":3}
```

Counts describe this transaction: skipped counts protected **Active** items only;
Sold/already-Paused items are excluded. An empty or repeated freeze succeeds with
the actual counts, including zero changes. The operation is atomic.

```json
{"action":"resume","listing_id":123}
```

HTTP 200:

```json
{"success":true,"listing_id":123,"status":"active"}
```

Resuming an already-Active owned item is idempotent. A Sold item returns 409 /
`Only paused listings can be restored.` Missing or nonowned IDs return the existing
404 / `Listing not found.` Anonymous mutations return 401; invalid IDs/body and
wrong methods retain the endpoint's 400/405 behavior. Database failures return
500 / `The listing could not be updated.` without partial changes.

`GET /listing/api/get_my_listings.php` adds two fields to each result:

- `can_freeze`: boolean, true only for an eligible Active item.
- `freeze_block_reason`: `approved_meeting`, `completed_meeting`, or null.
  Completed-meeting protection takes precedence when multiple meetings exist.

Existing fields and actions remain compatible. #231 must fail closed when the new
eligibility fields are missing and refresh authoritative state after a mutation.
Display `inactive` as **Paused**, not as a new stored status. Legacy
`get_listing.php` now returns 404 for inactive listings; its existing Sold-read
contract remains unchanged. Search, recommendations, recently viewed and favorites
already restrict results to Active items; regression tests verify these paths.

## Transactions and concurrency

Freeze locks the owner's Active listings in listing-ID order, then their meeting
rows. Request creation, seller responses and buyer location-change responses take
the same listing-first lock and reread current state. Sold and check-in already
use that lock order. Approval first means Freeze skips; Freeze first means stale
approval/acceptance/creation fails. Request creation first is canceled by a later
eligible freeze. Exceptions or failed mutations roll back before releasing locks.

## Reproducible checks

From the repository root, with PHP 8.3+ and the existing Composer dependencies:

```text
php vendor/bin/phpunit --filter 'ListingFreezeTest|ManageListingsTest|MeetingSaleTest|MeetingCheckinTest'
```

After generating a local test build, use a **disposable loopback MySQL** server,
PDO MySQL, mysqli, curl and permission to start PHP worker/server processes:

```powershell
$env:KARAVAN_FREEZE_TEST_DSN = 'mysql:host=127.0.0.1;port=YOUR_LOCAL_TEST_PORT'
php tests/mysql/listing_freeze_test.php
```

`KARAVAN_FREEZE_TEST_DOCROOT` optionally selects an isolated test build's `deploy`
directory instead of this checkout's `deploy`. The test rejects non-loopback DSNs,
creates a randomly named database/user, uses synthetic accounts and cleans up its
own records, sessions and processes. It performs real HTTP/PDO/mysqli checks,
observes real InnoDB lock waits to force both race orders, and injects a database
failure to verify rollback. Do not point it at Aptitude or Cattle.

Live readiness is separate. `tests/fixtures/listing-freeze/check_seller_fixtures.sql`
is read-only and reports the existing jia accounts/listings/meeting states without
resetting them. IDs differ by server. Preserve previous Sold/check-in data and
record any missing live fixture rather than silently rebuilding it.

## Delivery order

Merge #232, then implement/merge #231 against this contract. Generate the actual
upload bundle from merged dev in the normal `Repo/deploy` location. The isolated
build used for automated checks is not a release for upload. User uploads via the
existing WinSCP process: Aptitude validation first, then Cattle acceptance.

## Local verification — November 16, 2026

Frontend #231, based on merged #232 (`a10c51a`, PR #149):

- All 428 frontend tests in 31 files passed, including 20 new freeze UI cases.
  Changed-file lint passed without warnings.
- Thirty-six local Chromium + real PHP/MySQL checks passed: confirmation/back,
  keyboard focus containment/return, pending protection, exact counts, protected
  meetings, old item links, canceled requests, resume and fresh purchase.
- Desktop (1280×900) and mobile (390×844) screenshots were inspected. The toolbar
  aligns on desktop; mobile has no horizontal overflow and the full dialog fits.
  The actual disabled location retains readable colors and its saved ID is sent.
- Isolated production/manifest verification and six release regressions passed.
  Main `Repo/deploy` is still unchanged pending the frontend merge. These are
  local synthetic-fixture checks, not a Cattle/Aptitude acceptance pass.

Backend #232:

- Ten new deterministic business-rule tests passed (54 assertions).
- Forty real MySQL 8.0.46/HTTP checks passed, including both forced race orders,
  PDO/mysqli reads, stale forms and database-trigger rollback.
- Existing MySQL check-in regression: 12 checks passed. Location-lock regression:
  three checks passed after updating its stale temporary schema with the existing
  location-change fields; the missing-column failure also reproduced on dev.
- Isolated release build/178-file manifest verification and six release regression
  tests passed. The upload bundle in the main checkout was not rebuilt.
- Full PHP suite: 321 tests, 1,389 assertions; three ConfigTest duplicate-constant
  errors and two stale moderator-username assertions remain. All five reproduced
  on unchanged dev `3247b50`; they are not reported as passes or fixed here.
- Live jia fixture readiness remains unverified: both hosts failed local TLS
  certificate-chain verification. No certificate checks were bypassed and no
  live listing/request/approval/check-in data was changed.
