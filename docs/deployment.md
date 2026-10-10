# One repository, one release

## Source in GitHub, generated files in WinSCP

GitHub stores the organized source and build scripts. Running the build creates the
ignored `deploy/` directory. Upload its **contents** into
`/data/web/CSE442/2026-Fall/cse-442j/` on the selected course server.
Do not upload the outer `deploy` directory, `.git/`, frontend source, dependencies,
tests, SQL, or a teammate's personal copy. Rebuild after source changes so generated
files and source cannot silently diverge.

The repository is organized for development; the generated release retains the public
URL layout so existing page links, API clients, and database image URLs keep working.
Production references use the application's subdirectory, not the host's domain root.

## Before the first organized deployment

1. Finish/review the task on #165 before deciding to merge. Local verification alone
   is not a completed release or permission to overwrite teammates' server changes.
2. Coordinate one deployment owner and a pause on parallel WinSCP uploads.
3. Back up the current server directory and database. Reconcile any legitimate changes
   that exist only on the server into the appropriate source file first.
4. Install dependencies, run frontend/backend tests, build, and verify `deploy/`.
5. Confirm the server's `config.local.php` has the correct database settings. Listing,
   search, and item-details APIs now use the same configuration instead of embedded
   credentials. Do **not** deploy without checking this configuration.
6. Preserve existing user files under `listing/uploads/`, legacy `uploads/`, and the
   private `karavan_uploads/` document directory. Preserve server secrets and sessions.
7. Upload manifest-listed application files and `release-manifest.json`. The manifest
   is generated locally and is not committed. Do not use WinSCP's broad "delete files
   not present locally" option on the project root.
8. Only after review, remove obsolete application files listed in the old release
   manifest but absent from the new one. The first migration has no trustworthy old
   manifest; archive old bundles/personal copies manually rather than bulk-delete them.
9. Test navigation, login/logout on desktop/mobile, account/password settings, admin
   locations, Home purchase requests, Manage Listings, item details, meeting requests,
   communities, search filters, and Sell on the actual server.
10. Download the deployed application files for comparison if needed. Run
    `node scripts/verify/verify-release.mjs "D:/path/to/downloaded-release"` to compare
    its manifest hashes and local references. Compare it with a freshly generated local
    bundle as needed; a server-side manifest could itself have been overwritten.

## Configuration and runtime exceptions

- `config.local.php` or environment variables: database credentials; never tracked.
- `listing/uploads/`: runtime images. Only its protection `.htaccess` is a release file.
- `uploads/`: seed images in the generated bundle coexist with older runtime files; preserve nonmanifest
  user files and do not change image URLs in the database during this organization task.
- `karavan_uploads/`: private documents outside the web root, as configured.
- Database tables, sessions, logs: runtime state, not release files.

Use shared-group permissions rather than blanket `chmod 777`; only the runtime upload
directories need server write access. A Git release must not contain passwords/API keys.

## Page ownership

- Root HTML entries in `frontend/` build to root HTML in `deploy/`.
- `frontend/settings/` preserves account editing, account deletion, and password changes.
  The navigation's Settings link opens Account settings.
- Root `settings.html` retains the React approved-location Admin tab. Static settings
  pages expose its link only after the server confirms the user is an admin.
- Older nested home/search/sell/settings URLs are lightweight redirects, not extra apps.
- Shared React navigation owns desktop/mobile logout; old wrapper injection scripts and
  fixed historical bundle names are no longer used.

## Known limits outside this migration

The existing login cookie explicitly targets Aptitude. Cattle/localhost login-cookie
portability needs a separate reviewed authentication fix before claiming those flows
work there. Legacy static settings pages retain mobile
overflow; a navigation interaction test is not proof that those layouts meet the rubric's
mobile usability requirement. The SQLite local backend covers only
the APIs designed for it, not mysqli search/listing. No live server/database migration
is performed by these build scripts.
