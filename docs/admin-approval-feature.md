# Karavan: Community Partner (Admin) Registration + Moderator Approval

Context for writing test cards / automated tests for this feature (CSE442, team J).

## What the feature does (PM requirements)

1. A community partner applies to become an **admin** at `/admin-register`, submitting their details and a proof-of-ownership document (PDF/JPG/PNG, max 2MB — Aptitude's PHP upload limit).
2. Applying does **not** create an account. The application is stored in `admin_requests` with `status = 'pending'`.
3. A **moderator** logs in from the **standard login page** and is redirected to the moderator page (`/moderator`), which lists every pending request with the applicant's details and a link to their document, plus **Approve** / **Deny** buttons.
4. **Approve** creates a `users` row for the applicant (`username` = their email, their chosen password, `role = 'admin'`) and marks the request `approved`.
5. **Deny** deletes the request row and its uploaded document. No account is created.
6. All logins go through the standard login page. `users.role` controls permissions after login.

## Roles (`users.role`)

| Role | Who | How they get it |
|---|---|---|
| `user` | Regular accounts | Default for everyone, including the normal Register page |
| `admin` | Approved community partners | Set automatically when a moderator approves their request |
| `moderator` | Karavan staff | Set by hand: `UPDATE users SET role='moderator' WHERE username='...'` |

Only `moderator` can list, approve or deny requests or view documents. `user` and `admin` both get **403**.

## Database

Migration: `sql/001_admin_requests.sql`

- `users` gains `role ENUM('user','admin','moderator') NOT NULL DEFAULT 'user'`.
- New table `admin_requests`: `id` (AUTO_INCREMENT **starts at 5001**), `full_name`, `business_name`, `email` (UNIQUE), `phone`, `password_hash` (bcrypt via `password_hash()`), `proof_file_name` (random 32-hex name on disk), `proof_original_name`, `proof_mime_type`, `status ENUM('pending','approved')`, `user_id` (set on approval), `reviewed_by`, `reviewed_at`, `created_at`.
- Denied requests are **deleted**, so there is no `denied` status in the table.

## Backend endpoints (repo root, plain PHP + PDO)

All responses are JSON. Business logic is in `includes/admin_requests.php`; the endpoint files are thin wrappers.

### `POST admin_register.php` (multipart form-data)
Fields: `full_name`, `business_name`, `email`, `phone`, `password`, file `proof_of_ownership`.

The file checks run **before** the text-field checks.

| Case | Status | Body |
|---|---|---|
| Success | 201 | `{"success":true,"request_id":5001,"status":"pending"}` |
| No file | 400 | `{"success":false,"error":"Proof of ownership is required."}` |
| Wrong type (checks extension **and** real file content) | 400 | `{"success":false,"error":"Invalid file type. Accepted formats: PDF, JPG, PNG."}` |
| Over 2MB | 400 (413 if over PHP's 8MB post limit) | `{"success":false,"error":"File is too large. Maximum size is 2MB."}` |
| Empty (0 bytes) | 400 | `{"success":false,"error":"The file is empty. Please choose a different file."}` |
| Missing text field | 400 | `{"success":false,"error":"Please fill in all fields."}` |
| Bad email | 400 | `"Please enter a valid email address."` |
| Password < 8 chars | 400 | `"Password must be at least 8 characters."` |
| Email already has an account | 409 | `"An account with this email already exists."` |
| Email already has a request | 409 | `"A request for this email is already pending review."` |

- The file is saved under a random name in `upload_dir` (from `config.local.php`), which is not web-accessible.
- On rejection, no DB row is created and no file is written.
- All SQL uses prepared statements, so apostrophes and quotes in `business_name` are stored verbatim.

### `GET moderator_requests.php` (moderator session required)
- 200: `{"success":true,"requests":[{"request_id":5001,"full_name":"...","business_name":"...","email":"...","phone":"...","status":"pending","created_at":"...","proof_of_ownership_url":"proof_file.php?request_id=5001"}]}`
- Only `pending` rows are returned, oldest first. `password_hash` is never returned.
- Not a moderator, or not logged in: 403 `{"success":false,"error":"You do not have permission to perform this action."}`

### `POST moderator_approve.php` (JSON body, moderator session required)
Body: `{"request_id":5001,"action":"approve"}` or `{"request_id":5001,"action":"deny"}`

| Case | Status | Body / effect |
|---|---|---|
| Approve | 200 | `{"success":true,"request_id":5001,"status":"approved"}`. Creates a `users` row with role `admin`, and the request becomes `approved`. |
| Deny | 200 | `{"success":true,"request_id":5002,"status":"denied"}`. The request row and its file are deleted, and no user is created. |
| Not a moderator | 403 | Exact permission error above; nothing changes |
| Bad id or action | 400 | `success:false` |
| Unknown or already-denied id | 404 | `"Request not found."` |
| Already approved | 409 | `"This request has already been reviewed."` |
| Email taken since applying | 409 | `"An account with this email already exists."` (request stays pending) |

### `GET proof_file.php?request_id=N` (moderator only)
Streams the document with its real content type (inline). Non-moderators get 403; a missing file gets 404.

### `login.php` (updated)
- Starts a PHP session (`PHPSESSID` cookie) and returns `"role"` in the success response.
- The frontend redirects `role === 'moderator'` to `/moderator`.
- A pending applicant has no account yet, so they get `"Invalid username or password."`

### `logout.php`
Destroys the session.

### Config
`includes/config.php` reads database settings from environment variables (`KARAVAN_DB_*`) or a gitignored `config.local.php`. `login.php` and `register.php` also use it now, so there are no hardcoded credentials.

## Frontend (React + Vite in `karavan-login/src`)

- `/admin-register`: `pages/AdminRegister.jsx`.
  - **Layout:** Figma layout with a two-column desktop view (brand left, form card right) that stacks on mobile.
  - **Fields:** Full Name, Business / Community Name, Email Address, Phone Number, Password, Confirm Password.
  - **Upload:** `components/FileDropzone.jsx`, drag-and-drop or click-to-browse.
  - **Validation before sending:** all fields required, email format, password ≥ 8, passwords match, file present/type/size. If there's no file, the upload box gets a red outline (`kv-dropzone--error`) and **no request is sent**.
  - **Success:** shows "Your request is pending review".
  - **Server file errors:** shown on the upload box; other errors in a red banner.
  - **Other details:** exactly one van logo on the page. There is no SSO option; partners register with the form only.
- `/moderator`: `pages/ModeratorDashboard.jsx` with `components/PendingRequestCard.jsx`.
  - **Each card:** name, business, email, phone, date applied, "View proof of ownership" link (new tab), Approve and Deny.
  - **After a decision:** the card is removed and a green confirmation appears ("Approved <name>'s request for <business>.").
  - **Empty list:** "No pending requests. You're all caught up."
  - **Non-moderators:** a 403 shows "Moderator access required".
  - **No notification bell** (removed on purpose).
- `/` (base URL): the existing login page (`App.jsx`); a moderator login redirects to `/moderator`.
- `routes.js`: resolves routes relative to wherever `index.html` is served from, so it works in a subfolder. The app links with hash routes (`#/moderator`, `#/admin-register`) because Aptitude does not apply the `.htaccess` rewrites; `main.jsx` re-renders on `hashchange`. The plain paths (`/moderator`) still work locally and on servers where `.htaccess` is honored.

## Existing automated tests (all passing)

Run from the repo root:
```bash
vendor/bin/phpunit                 # 54 backend tests (SQLite, no MySQL needed)
cd karavan-login && npm test       # 36 frontend tests (Vitest + React Testing Library)
```

| File | Covers |
|---|---|
| `tests/Unit/AdminRegisterTest.php` | File required/type/size, hashing, no user created, random filenames, apostrophes, duplicate emails |
| `tests/Unit/ModeratorTest.php` | 403 for none/user/admin roles, pending-only list, approve creates an admin user, deny deletes row + file, double decisions, bad payloads, proof file access |
| `tests/Http/EndpointsHttpTest.php` | Real endpoints over HTTP via `php -S`: exact response bodies from the task cards (IDs 5001/5002, Alex Landlord data), `.exe` rejection writes no file, real `login.php` sessions for moderator/admin/pending applicant |
| `karavan-login/src/__tests__/AdminRegister.test.jsx` | Form controls, no request without a file, red outline, client type/size checks, FormData contents, confirmation, server errors |
| `karavan-login/src/__tests__/ModeratorDashboard.test.jsx` | List rendering, empty state, approve/deny remove the card + confirm, error handling, 403 page |
| `karavan-login/src/__tests__/TaskCards.test.jsx` | Mirrors the manual task cards, including moderator login redirecting to `/moderator` and exact approve/deny request bodies |
| `karavan-login/src/__tests__/routes.test.js` | Route/base-path resolution in subfolders |

Test helpers: `tests/Support/TestDatabase.php` (SQLite copy of the schema, IDs also start at 5001) and `tests/Support/Fixtures.php` (valid PDF/PNG/JPG bytes, fake uploads).

## Running it locally with real logins

```bash
./dev/start-backend.sh                          # terminal 1: PHP on :8000, SQLite at dev/local.sqlite
cd karavan-login && npm run dev:backend         # terminal 2: http://localhost:5173
```
Seeded accounts: `mod@test.com` / `Moderator123!` (moderator) and `user@test.com` / `User12345!` (user). Reset with `php dev/setup_local_db.php`.

## Deployed test environment

- Site: https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/ayushstuff/
- Registration: `.../ayushstuff/#/admin-register`
- Moderator page: `.../ayushstuff/#/moderator`
- It uses the shared team database `cse442_2026_fall_team_j_db`.
- The moderator account is created by registering normally, then setting `role='moderator'` in phpMyAdmin.

## Manual end-to-end checklist (Aptitude)

1. Register an applicant with a PDF. Expect the pending message; `admin_requests` has a `pending` row with a `$2y$` hash; `users` has **no** row for that email.
2. Log in as the applicant. Expect "Invalid username or password."
3. Log in as the moderator. Expect a redirect to `/moderator` with the request listed.
4. Click "View proof of ownership". The document opens (no 404).
5. Click Approve. Expect a confirmation and the card disappears; `users` now has the email with `role = admin`.
6. Log in as the applicant. Expect "Login successful!" and no redirect to `/moderator`.
7. As the applicant, open `/moderator`. Expect "Moderator access required".
8. Register a second applicant, then Deny as the moderator. The `admin_requests` row is gone, no `users` row exists, and the file is gone from `karavan_uploads`.

## Notes for writing test cards

- **Order matters:** request IDs depend on insertion order. On a fresh table the first request is 5001 and the second is 5002. Reset with:
  ```sql
  DELETE FROM admin_requests;
  DELETE FROM users WHERE role = 'admin';
  ALTER TABLE admin_requests AUTO_INCREMENT = 5001;
  ```
- **Postman tests need a moderator `PHPSESSID`:** log in through the site, then copy the `PHPSESSID` cookie from DevTools → Application → Cookies.
- **Client checks run first:** the frontend blocks bad files (e.g. `.exe`) before sending anything, so a network override for that case is never hit. The error message still appears.
- **Known gaps / not built:**
  - University SSO
  - A partner-admin dashboard (approved admins just see "Login successful!")
  - A distinct "pending" message on login for applicants
  - Email notifications
  - Uploads outside the web root on Aptitude: `karavan_uploads` currently sits inside the site folder, because that's where the web server can write. Apache ignores `.htaccess` there, so the folder is protected only by a blank `index.html` (written automatically on the first upload) and random 32-character file names. The documents themselves are served to moderators through `proof_file.php`.
- **Test upload files** live in `docs/test-files/`; `docs/task-cards.md` lists what each one should do.
