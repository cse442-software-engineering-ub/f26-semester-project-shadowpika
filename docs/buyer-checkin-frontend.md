# Buyer location check-in frontend — #205

## Behavior

Home shows **Check In** only on approved buyer meetings with an integer `request_id`. It opens `check-in.html?request_id=...`, protected by the existing login guard. The page loads details from #206's `api/get_meeting_checkin.php`; there is no production mock or local-success fallback.

The page uses the agreed meeting location, displays its label and a shared Leaflet map with a 100 m circle, and reuses the existing meeting date/time formatting and navigation. Other uses of the shared map keep their default 45 m selection circle. Missing coordinates block check-in; a failed map tile does not prevent verification when the actual coordinates and device reading are valid.

**Allow location** starts high-accuracy browser location monitoring with `maximumAge:0` and a 15-second timeout. A reading must be at most 30 seconds old, have accuracy ≤100 m, and be within 100 m. Position changes, expired readings, or location errors disable **I'm here**. Transient errors keep monitoring so a recovered signal can update the page; denied permission stops monitoring and displays the original acceptance-test message.

The page derives the allowed window from #206's server timestamps, anchored to a monotonic browser clock. It refreshes at the opening/closing boundary and when restored from the background. Hidden pages invalidate readings and pending callbacks. Location watchers are cleared on hiding, unmounting and successful check-in.

Submitting obtains a new reading before posting its `latitude`, `longitude`, `accuracy_m`, and actual `captured_at` Unix-millisecond timestamp with `request_id`. Duplicate clicks are blocked. Only a server-confirmed timestamp produces **Checked in at …** and removes **I'm here**. On a failed POST response, the page reloads the authoritative state in case the server completed the write before the connection failed. Reloading an already checked-in meeting requires no location permission.

Sell's Create Listing form no longer renders, validates or submits `related_course`. Existing editing/search behavior and stored course values remain intact.

## Dependencies and release

- This branch is based on dev and deliberately does not include #206's source. Its UI tests use mocked API contracts. The current frontend-only `deploy/` must not be uploaded as the complete #58 release.
- Integrate **both #205 and #206** before generating the deployment bundle. The user handles Git branches, commits, pushes, PRs and merges.
- #206 adds `request_id` to the buyer list, the two check-in endpoints and `checked_in_at`. Its complete contract and migration/deployment instructions are in `docs/buyer-checkin.md` on the backend branch and will be available after integration.
- The final release verifier must retain all three new route checks: `check-in.html`, `api/get_meeting_checkin.php`, and `api/check_in_meeting.php`.
- On the verified Aptitude **postsprint/** target, back up application/database state, apply #206's additive migration, then upload only generated manifest-listed files. Preserve the parent grading deployment, server configuration, sessions and uploads.
- After Git integration, rebuild and verify the final combined bundle. Do not use files from a temporary local test overlay for deployment.

## Tests

From `frontend/`, run `npm test`. New `CheckIn.test.jsx` cases use mocked APIs, geolocation and clocks; they require neither the backend nor grading data. Existing Home, map, login-guard and Create Listing tests cover the new entry point and compatibility changes.

Verify initial disabled state, inclusive distance/accuracy/freshness boundaries, moving outside the area, stale readings, denied permission, unsupported geolocation, timeout and signal recovery, opening/closing refresh, page visibility, late callbacks, fresh submission readings, failed responses, persisted success, and map-tile failure. Confirm the request body uses the meeting ID and fresh position rather than a listing ID or cached coordinate.

For visual/keyboard checks, use desktop and 390 px mobile layouts. Ensure no horizontal overflow, readable meeting information, visible pin/circle, and keyboard-operable controls. Use separate temporary meetings for integrated API testing; never check in to or reset the reserved November 6 Desk Organizer/Graphing Calculator meetings during development.

The original Cattle User Story remains in the workspace's `#58&frontend+backend.md`, unchanged. Its fixed December 18 pre-opening test is not valid after its opening time; use separately named future meetings for ongoing development tests.

## Local verification record — October 26, 2026

- Final frontend suite: **18 files / 259 tests passed**, including **22 dedicated check-in tests**. Production build and **4 release checks** passed. The new entrypoint, component and location/session modules pass targeted oxlint without warnings.
- Browser smoke checks use mocked APIs and browser geolocation. They verify keyboard location access, movement gating, the fresh POST, refresh persistence, Sell removal, and viewport overflow.
- A separate temporary overlay combines the current #205 build with committed #206 backend files via read-only Git inspection. Real PHP/SQLite integration passed: Home entry, location reading, successful POST, persisted state after reload, and idempotent retry. This did not merge or modify either Git branch.
- Mocked geolocation and local integration do not establish physical presence at Baldy 19 or success on Cattle. Live deployment, migration on the intended server, and phone-based physical-location acceptance are still pending.

## User-run Git handoff

Backend #206 was committed by the user as **e755907** on **206-backend-buyer-location-check-in**. Frontend work is on **205-frontend-buyer-location-check-in**, based on dev **970d152**. These are local observations, not claims about remote PR/merge status.

From the repository root, stage only the frontend feature files below. This intentionally excludes the four pre-existing test changes (`tests/api/create_listing_api_test.ps1`, `tests/api/meeting_location_api_test.ps1`, `tests/backend/Unit/CommunityListingTest.php`, and `tests/api/script_runner.test.mjs`). The workspace task-card Markdown is outside the repository and is not part of this commit.

```powershell
$checkinFrontendFiles = @(
    'frontend/check-in.html'
    'frontend/src/check-in-main.jsx'
    'frontend/src/CheckIn.jsx'
    'frontend/src/CheckIn.css'
    'frontend/src/checkin.js'
    'frontend/src/useCheckin.js'
    'frontend/src/Home.jsx'
    'frontend/src/components/LocationsMap.jsx'
    'frontend/src/features/listings/CreateListing.jsx'
    'frontend/src/__tests__/CheckIn.test.jsx'
    'frontend/src/__tests__/CreateListing.test.jsx'
    'frontend/src/__tests__/ItemMeetingLocation.test.jsx'
    'frontend/src/__tests__/MeetingRequests.test.jsx'
    'frontend/src/__tests__/RequireLogin.test.jsx'
    'frontend/vite.config.js'
    'scripts/verify/verify-release.mjs'
    'docs/buyer-checkin-frontend.md'
)
git add -- $checkinFrontendFiles
git diff --cached --stat
git commit -m "Add buyer location check-in frontend and simplify Sell (#205)"
```

After reviewing/merging both feature branches through the team's normal Git workflow, regenerate and verify the combined bundle. Keep both #206's endpoint checks and #205's page check if resolving a conflict in the release verifier. The local `deploy/` currently reflects #205 alone and is not ready for a complete #58 server deployment.
