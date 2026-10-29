# Buyer location check-in — #58 / backend #206 / frontend #205

## Contract

All routes are relative to the deployment root (Aptitude development currently uses `postsprint/`). Requests use the existing session cookie. No production endpoint accepts an injected clock or a bypass for distance, time, or ownership.

`GET api/get_my_meeting_requests.php` now includes the integer `request_id` in each request. All other fields retain their existing meaning.

`GET api/get_meeting_checkin.php?request_id=123` returns `{success:true, meeting:{...}}`. The meeting contains:

- `request_id`, `listing_id`, `name`, decimal-string `price`, nullable `image_url`, `meeting_date`, `meeting_time`, and meeting `status`.
- `location_label` and nullable `location: {location_id, label, lat, lng}`. Coordinates come from the meeting's location ID, never the listing's current preferred location.
- `radius_m:100`, `max_accuracy_m:100`, `max_age_seconds:30`, `timezone:"America/New_York"`.
- UTC ISO-8601 timestamps `opens_at`, `closes_at`, `server_now`, and nullable `checked_in_at`.
- `checkin_state`: `open`, `not_open`, `closed`, `not_approved`, `location_unavailable`, or `checked_in`.

`POST api/check_in_meeting.php` accepts JSON:

```json
{
  "request_id": 123,
  "latitude": 43.0,
  "longitude": -78.78,
  "accuracy_m": 20,
  "captured_at": 1793984400000
}
```

The coordinate values above are illustrations, not grading fixtures. `captured_at` is the browser GeolocationPosition timestamp in **Unix milliseconds**; use the actual reading, not the example value. Coordinates, accuracy and timestamp must be JSON numbers. Latitudes are within ±90, longitudes within ±180, and accuracy must be nonnegative.

Only the corresponding buyer of an approved meeting can check in. The server computes Haversine distance using a 6,371,000 m Earth radius. Distance ≤100 m and accuracy ≤100 m are accepted. Readings may be up to 30 seconds old or up to 5 seconds ahead of the server clock. The inclusive time window is 15 minutes before to 2 hours after the meeting, interpreted in America/New_York.

Success returns `{success:true, checked_in_at:"...Z"}`. The first server timestamp is stored as UTC in `meeting_requests.checked_in_at`; the meeting remains approved and the listing is unchanged. A repeated request by the same buyer for an already checked-in, still-approved meeting returns the first timestamp even if its location reading has expired. There is no second check-in event.

Errors return `{success:false,error:"...",code:"..."}` for business validation. Statuses: 400 malformed input, 401 no session, 404 missing/other buyer's meeting, 409 meeting/location/window ineligible, 422 stale/inaccurate/distant location, 405 wrong method, 500 generic internal failure. Authentication/method/internal errors follow existing conventions and may omit `code`. Business codes are `invalid_request`, `not_found`, `not_approved`, `location_unavailable`, `not_open`, `closed`, `invalid_location`, `stale_location`, `inaccurate_location`, `too_far`, and `meeting_changed`.

The browser must not treat enabled controls as authoritative server validation. Device location is client-supplied evidence, not protection against spoofed GPS. Raw positions are neither stored by this feature nor written to application logs.

## Database and release

1. Verify the deployment directory and configured database; a separate `postsprint/` directory does not imply a separate database. Coordinate uploads and back up the application and database.
2. Run `database/migrations/012_meeting_checkin.sql` after the meeting-request schema exists. It adds one nullable `DATETIME(6)` column and does not seed or update existing meetings. It is safe to rerun. Fresh installations use the updated `database/schema/meeting_requests.sql`.
3. Generate the bundle with `node scripts/build/build-release.mjs`, then verify it with `node scripts/verify/verify-release.mjs`. The backend release must contain both new endpoints and `includes/meeting_checkin.php`.
4. Deploy manifest-listed application files only. Preserve credentials, sessions, user uploads, and the parent grading deployment. Do not run shared grading seeds as part of deployment.
5. Roll back application files if needed; leave the additive timestamp column and successful check-ins intact.

## Backend verification

### October 29 follow-up: shared progress and approved locations (#206)

Both `api/get_my_meeting_requests.php` and
`api/get_incoming_meeting_requests.php` now include nullable `checked_in_at`.
Before check-in it is `null`; after success, both participants receive the same
UTC ISO-8601 timestamp as the submission response, for example
`2026-11-06T17:00:00.000Z`. The meeting remains `approved`. No raw device coordinates
are added to either list. Lists remain scoped to the authenticated buyer or the
owner of the requested listing; the seller cannot submit the buyer's check-in.

The frontend must refresh these lists to show changes made in another session.
This backend update alone does not add live updates to Home. The #205 follow-up
will display the progress and refresh it while visible and on return to the page.

Approved meetings already reject response mutations through a conditional
`status = 'pending'` update. Changing an approved location now returns an explicit
409 message: `The meeting location is locked after approval.` Other stale
responses continue returning 409. A location-change proposal and approval racing
on a pending request cannot both succeed. Editing the listing's preferred location
does not alter the meeting's own stored location. Administrative deletion of a
location continues to make check-in unavailable; this is not a substitute location
or an address change. No new schema migration or data reset is required; the
existing `012_meeting_checkin.sql` must already be applied.

Reusable follow-up checks, run from the repository root:

```powershell
php vendor/phpunit/phpunit/phpunit tests/backend/Unit/MeetingCheckinTest.php
node scripts/build/build-release.mjs
php vendor/phpunit/phpunit/phpunit tests/backend/Http/MeetingCheckinHttpTest.php
```

The unit file now covers both participants' progress, unrelated-account isolation,
locked locations before/after check-in, and listing edits, in addition to existing
validation and time/distance boundaries: **13 tests / 105 assertions**. The HTTP
file verifies an actual buyer POST followed by both accounts' list reads and a
rejected seller edit: **3 tests / 72 assertions**. Both passed locally on October 29.

With the same disposable loopback MySQL prerequisites described below:

```powershell
$env:KARAVAN_CHECKIN_TEST_DSN = 'mysql:host=127.0.0.1;port=33316'
php tests/mysql/meeting_location_lock_test.php
php tests/mysql/meeting_checkin_test.php
Remove-Item Env:KARAVAN_CHECKIN_TEST_DSN
```

The new location-lock script creates and deletes only its random
`meeting_lock_test_*` database and temporary workers. It prints **3 PASS lines**:
exactly one concurrent response wins; the losing stale response cannot overwrite
that winner's location; an approved meeting with an existing check-in cannot be
edited. The original migration/check-in script continues printing **7 PASS lines**.
Both passed on a separate local MariaDB instance, which was shut down afterward.
These tests do not access Aptitude/Cattle, the Station fixture or grading meetings.

Full backend regression on October 29: **253 tests / 941 assertions**, with the
same **3 existing ConfigTest errors** caused by duplicate
`KARAVAN_NOT_LOGGED_IN_ERROR` definitions. The dedicated check-in files pass
independently; the complete backend suite is not fully green. Release build,
manifest verification and all **4 release tests** also pass.

GitHub source links are the repository's `dev` paths once the user merges this
follow-up; the new script is not available there until that merge. Local passing
results do not establish that the deployed application contains these changes.

From the repository root, with PHP available:

```powershell
php vendor/phpunit/phpunit/phpunit tests/backend/Unit/MeetingCheckinTest.php
node scripts/build/build-release.mjs
php vendor/phpunit/phpunit/phpunit tests/backend/Http/MeetingCheckinHttpTest.php
node --test tests/release/verify-release.test.mjs
```

These tests use independent disposable SQLite data. Unit tests inject a clock directly into business functions; the HTTP endpoints do not expose that option. HTTP tests call the generated PHP endpoints with private test sessions and verify database persistence.

For migration, fresh schema and concurrent-write verification, start a dedicated local MySQL/MariaDB instance with a passwordless root account, restricted to loopback. Never point this at an application server. The test creates a random `checkin_test_*` database and removes only that database afterward:

```powershell
$env:KARAVAN_CHECKIN_TEST_DSN = 'mysql:host=127.0.0.1;port=33316'
php tests/mysql/meeting_checkin_test.php
Remove-Item Env:KARAVAN_CHECKIN_TEST_DSN
```

The migration test checks two migration runs against an existing meeting, concurrent submissions from separate PHP processes, persistence across another migration run, and the fresh-install schema.

## Aptitude manual API acceptance (pending deployment)

Use authenticated sessions for dedicated test buyer and seller accounts and separately created temporary meetings. Record their IDs before any write. Do not use the November 6 Desk Organizer or Graphing Calculator grading meetings.

1. GET the buyer's meeting list and verify integer request IDs. GET the temporary approved meeting's check-in details; compare its location ID and coordinates with that meeting's database row, not the listing's preferred location.
2. Check the same ID with no session and with the seller's session; expect 401 and 404 respectively. Send invalid IDs, missing coordinates and wrong methods; verify safe JSON and no timestamp write.
3. On a dedicated approved meeting whose window is currently open, POST a fresh numeric position within 100 m with accuracy ≤100 m. Verify success, a single UTC database timestamp, and unchanged meeting/listing status.
4. Repeat the POST and refresh the GET. Verify the same stored timestamp. Do not reset it to rerun the test; create another temporary meeting.
5. With separate unconsumed fixtures, test a position beyond 100 m, accuracy over 100 m, reading older than 30 seconds, and reading more than 5 seconds in the future. Each returns 422 without a write. Test pending and outside-window meetings; expect 409.
6. Compare the service timestamps with the meeting's New York date/time. Exercise exact time and distance boundaries in the isolated automated tests rather than changing shared server clocks or grading records.
7. Cleanup only the temporary records whose IDs were recorded for this run. Record URL, source revision, results, and remaining limitations.

## Verification record

- 2026-10-26: new backend unit tests: 10 tests / 73 assertions passed.
- 2026-10-26: new backend HTTP tests: 2 tests / 44 assertions passed.
- 2026-10-26: temporary MariaDB migration, concurrency, preservation and fresh-schema checks passed.
- 2026-10-26: release verification: 4 tests passed. Complete backend run: 250 tests / 883 assertions, with 3 existing ConfigTest errors caused by duplicate `KARAVAN_NOT_LOGGED_IN_ERROR` definitions in auth/meeting includes. The suite is not fully green; this feature does not alter that existing configuration issue.
- Live Aptitude/Cattle deployment and phone-based physical-location acceptance have not been performed by these local tests.
