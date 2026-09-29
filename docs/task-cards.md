# Task card acceptance tests (updated to match the built flow)

`[APTITUDE_BASE_URL]` = `https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/ayushstuff`

## What changed from the original cards

- **No notification bell.** Moderators log in on the normal login page and are sent to the moderator page, `[APTITUDE_BASE_URL]/#/moderator`, which lists every pending request.
- **Page URLs use `#/`** (`/#/admin-register`, `/#/moderator`) because Aptitude ignores `.htaccess` rewrites.
- **Applicants have no account until approved.** Approve *creates* a `users` row with `role = 'admin'` (it doesn't update an existing one). Deny *deletes* the request and its document, so there is no "denied" row to look at afterwards.
- **Applying doesn't need a login**, so the "log in and obtain PHPSESSID" step is gone from the admin-register backend cards.
- **Request IDs:** `5001` / `5002` are only guaranteed on a freshly created `admin_requests` table. On Aptitude, IDs keep counting up after every test run, so use the `request_id` the register call returned.
- **The upload limit is 2MB, not 10MB.** Aptitude's PHP rejects anything over 2MB and ignores `.user.ini`/`.htaccess` overrides, so the app, the messages and these cards all use 2MB.

## Test files

Attach these to the task cards. Testers download them and use them **by name**; they're also in the repo under `docs/test-files/`.

| File | What it is | Expected result |
|---|---|---|
| `valid_lease.pdf` | Real 1-page PDF (1KB) | Accepted |
| `valid_deed.jpg` | Real JPG image (38KB) | Accepted |
| `valid_business_license.png` | Real PNG image (4KB) | Accepted |
| `valid_1.9MB_lease.pdf` | Real PDF just **under** the 2MB limit | Accepted |
| `too_large_2.5MB_lease.pdf` | Real PDF **over** the 2MB limit | `File is too large. Maximum size is 2MB.` |
| `empty_0KB_lease.pdf` | 0-byte file with a `.pdf` name | `The file is empty. Please choose a different file.` |
| `wrong_type_setup.exe` | Harmless text file with a `.exe` name | `Invalid file type. Accepted formats: PDF, JPG, PNG.` |
| `wrong_type_notes.txt` | Plain text file | `Invalid file type. Accepted formats: PDF, JPG, PNG.` |
| `fake_lease.pdf` | Text file renamed to `.pdf` (right name, wrong contents) | `Invalid file type. Accepted formats: PDF, JPG, PNG.` (from the server) |

If an email/Discord upload blocks `wrong_type_setup.exe`, use `wrong_type_notes.txt` for the same tests.

## Test accounts

| Placeholder | Value | Role |
|---|---|---|
| `[MODERATOR_TEST_EMAIL]` / `[MODERATOR_TEST_PASSWORD]` | `mod@test.com` / `Moderator123!` | moderator |
| `[TEST_EMAIL]` / `[TEST_PASSWORD]` | any account made with "Register here" on the login page | user |

**Getting a PHPSESSID for Postman:** log in on `[APTITUDE_BASE_URL]` in Chrome, then open DevTools → Application → Cookies → `aptitude.cse.buffalo.edu` and copy the `PHPSESSID` value. In Postman, add the header `Cookie: PHPSESSID=<value>`. Alternatively, POST `[APTITUDE_BASE_URL]/login.php` in Postman with raw JSON `{"username":"...","password":"..."}`; Postman keeps the cookie automatically.

---

## Frontend: Admin Registration Page (#101)

### Test 1 — Detects failure to render required registration form controls
1. Open `[APTITUDE_BASE_URL]/#/admin-register`.
2. Set the browser window to 1440 × 900.
3. Verify the page contains exactly one of each: Karavan van logo, "Register as a Community Partner" heading, "Continue with University SSO" button, Full Name, Business / Community Name, Email Address, Phone Number, Password, Confirm Password, the proof-of-ownership upload control, and the "Submit for Approval" button.
4. Verify there is no horizontal scrolling.

### Test 2 — Detects failure to submit a complete, valid registration
1. Open `[APTITUDE_BASE_URL]/#/admin-register`.
2. Open Developer Tools → Network.
3. Fill in Full Name `Alex Landlord`, Business Name `Landlord Properties LLC`, an email address not used before, Phone `123-456-7890`, Password and Confirm Password `Landlord123!`.
4. Download `valid_lease.pdf` and upload it to the proof-of-ownership control.
5. Click "Submit for Approval."
6. Verify a POST to `admin_register.php` returns 201.
7. Verify "Your request is pending review" is shown on the page.
8. Repeat steps 1–7 with a new email each time, using `valid_deed.jpg`, then `valid_business_license.png`, then `valid_1.9MB_lease.pdf`. Verify each one is accepted.

### Test 3 — Detects failure to block submission when proof-of-ownership is missing
1. Open `[APTITUDE_BASE_URL]/#/admin-register`.
2. Open Developer Tools → Network and clear the log.
3. Fill in every field except the upload.
4. Click "Submit for Approval."
5. Verify no request is sent to `admin_register.php`.
6. Verify the upload control is outlined in red and "Proof of ownership is required." is shown.

### Test 4 — Detects failure to block a wrong file type
1. Open `[APTITUDE_BASE_URL]/#/admin-register`.
2. Open Developer Tools → Network and clear the log.
3. Fill in all fields, then drag `wrong_type_setup.exe` from your Downloads folder onto the upload box. (The file picker greys out non-PDF/JPG/PNG files, so dragging is the reliable way.)
4. Click "Submit for Approval."
5. Verify no request is sent to `admin_register.php` (the page rejects it before sending).
6. Verify the upload control is outlined in red and "Invalid file type. Accepted formats: PDF, JPG, PNG." is shown.
7. Verify no success confirmation is displayed.
8. Repeat with `wrong_type_notes.txt` and verify the same result.

### Test 5 — Detects failure to block a file that is too large
1. Open `[APTITUDE_BASE_URL]/#/admin-register`.
2. Open Developer Tools → Network and clear the log.
3. Fill in all fields and upload `too_large_2.5MB_lease.pdf`.
4. Click "Submit for Approval."
5. Verify no request is sent to `admin_register.php`.
6. Verify the upload control is outlined in red and "File is too large. Maximum size is 2MB." is shown.
7. Verify no success confirmation is displayed.

### Test 6 — Detects failure to block an empty file
1. Open `[APTITUDE_BASE_URL]/#/admin-register`.
2. Open Developer Tools → Network and clear the log.
3. Fill in all fields and upload `empty_0KB_lease.pdf`.
4. Click "Submit for Approval."
5. Verify no request is sent to `admin_register.php`.
6. Verify the upload control is outlined in red and "The file is empty. Please choose a different file." is shown.

### Test 7 — Detects failure to show the server's rejection of a disguised file
1. Open `[APTITUDE_BASE_URL]/#/admin-register`.
2. Open Developer Tools → Network.
3. Fill in all fields (use a new email) and upload `fake_lease.pdf`. The name looks fine, so the page sends it.
4. Click "Submit for Approval."
5. Verify a POST to `admin_register.php` is sent and returns 400.
6. Verify the upload control is outlined in red and "Invalid file type. Accepted formats: PDF, JPG, PNG." is shown.
7. Verify no success confirmation is displayed.

### Test 8 — Detects failure to render responsively at mobile size
1. Open `[APTITUDE_BASE_URL]/#/admin-register`.
2. In Chrome DevTools, set the viewport to 390 × 844.
3. Verify all form controls stack vertically in one column.
4. Verify there is no horizontal scrolling and every control is fully visible.

---

## Backend: Admin Registration (#102)

### Test 1 — Detects failure to create a pending admin request with valid data
1. In Postman, create a POST request to `[APTITUDE_BASE_URL]/admin_register.php`. No login is needed.
2. Body → form-data: `full_name=Alex Landlord`, `business_name=Landlord Properties LLC`, `email=alex.landlord@test.com`, `phone=123-456-7890`, `password=Landlord123!`, and a **File** field `proof_of_ownership` with `valid_lease.pdf`.
3. Send the request.
4. Verify the HTTP status is 201.
5. Verify the response is `{"success":true,"request_id":<id>,"status":"pending"}` (`<id>` is `5001` on a fresh table). Write down the `<id>`.
6. In phpMyAdmin, verify `admin_requests` has a row with that id and `status = 'pending'`.
7. Verify its `password_hash` starts with `$2y$` (hashed by `password_hash()`), not `Landlord123!`.
8. Verify `users` has **no** row with `username = 'alex.landlord@test.com'` yet.

### Test 2 — Detects failure to reject a request missing the proof-of-ownership file
1. In Postman, POST to `[APTITUDE_BASE_URL]/admin_register.php` with the same fields as Test 1 (use a new email) but no file.
2. Verify the HTTP status is 400.
3. Verify the response is exactly `{"success":false,"error":"Proof of ownership is required."}`
4. Verify no new row is created in `admin_requests`.

### Test 3 — Detects failure to reject a disallowed file type
1. In Postman, POST to `[APTITUDE_BASE_URL]/admin_register.php` with the same fields (a new email) and `wrong_type_setup.exe` as `proof_of_ownership`.
2. Verify the HTTP status is 400.
3. Verify the response is exactly `{"success":false,"error":"Invalid file type. Accepted formats: PDF, JPG, PNG."}`
4. Verify no new row is created in `admin_requests` and no new file appears in `ayushstuff/karavan_uploads` (check in FileZilla).
5. Repeat with `wrong_type_notes.txt` and with `fake_lease.pdf` (a text file renamed to `.pdf`; the server checks the contents, not just the name). Verify the same 400 response each time.

### Test 4 — Detects failure to reject a file that is too large
1. In Postman, POST to `[APTITUDE_BASE_URL]/admin_register.php` with the same fields (a new email) and `too_large_2.5MB_lease.pdf` as `proof_of_ownership`.
2. Verify the HTTP status is 400.
3. Verify the response is exactly `{"success":false,"error":"File is too large. Maximum size is 2MB."}`
4. Verify no new row is created in `admin_requests`.
5. Repeat with `valid_1.9MB_lease.pdf` (a new email). Verify 201 — files just under the limit are accepted.

### Test 5 — Detects failure to reject an empty file
1. In Postman, POST to `[APTITUDE_BASE_URL]/admin_register.php` with the same fields (a new email) and `empty_0KB_lease.pdf` as `proof_of_ownership`.
2. Verify the HTTP status is 400.
3. Verify the response is exactly `{"success":false,"error":"The file is empty. Please choose a different file."}`
4. Verify no new row is created in `admin_requests`.

### Test 6 — Detects failure to keep uploaded documents private
1. After Test 1, open `[APTITUDE_BASE_URL]/karavan_uploads/` in a browser.
2. Verify the page is blank and does **not** list any files.
3. Log out (or use a private window) and open `[APTITUDE_BASE_URL]/proof_file.php?request_id=<id>` with the id from Test 1.
4. Verify the response is 403 `{"success":false,"error":"You do not have permission to perform this action."}`

### Test 7 — Detects failure to block a pending applicant from logging in
1. After Test 1, open `[APTITUDE_BASE_URL]`.
2. Log in with `alex.landlord@test.com` / `Landlord123!`.
3. Verify login fails with "Invalid username or password."

---

## Frontend: Moderator Approval Page (#103)

Setup: submit two applications through `[APTITUDE_BASE_URL]/#/admin-register` so at least two requests are pending: Alex Landlord / Landlord Properties LLC with `valid_lease.pdf`, and a second applicant with `valid_deed.jpg`.

### Test 1 — Detects failure to route a moderator to the pending-request list
1. Open `[APTITUDE_BASE_URL]`.
2. Log in with `[MODERATOR_TEST_EMAIL]` / `[MODERATOR_TEST_PASSWORD]` on the normal login page.
3. Verify the browser goes to `[APTITUDE_BASE_URL]/#/moderator` with the heading "Pending partner requests".
4. Verify the list shows an entry containing "Alex Landlord" and "Landlord Properties LLC".

### Test 2 — Detects failure to display the proof-of-ownership document
1. Log in as the moderator (you land on `[APTITUDE_BASE_URL]/#/moderator`).
2. In Alex Landlord's entry, verify there is a "View proof of ownership" link.
3. Click it.
4. Verify the document opens in a new tab with no 404 or broken-link error, and it's the "Sample Lease Agreement" from `valid_lease.pdf`.

### Test 3 — Detects failure to approve a pending request
1. Log in as the moderator.
2. Open DevTools → Network.
3. Click "Approve" on Alex Landlord's entry.
4. Verify a POST to `moderator_approve.php` is sent with body `{"request_id":<id>,"action":"approve"}` and returns 200.
5. Verify the message "Approved Alex Landlord's request for Landlord Properties LLC." is shown.
6. Verify Alex Landlord no longer appears in the pending list, including after refreshing the page.

### Test 4 — Detects failure to deny a pending request
1. Log in as the moderator.
2. Open DevTools → Network.
3. Click "Deny" on the second applicant's entry.
4. Verify a POST to `moderator_approve.php` is sent with body `{"request_id":<id>,"action":"deny"}` and returns 200.
5. Verify the message "Denied <name>'s request for <business>." is shown.
6. Verify the entry no longer appears in the pending list, including after refreshing the page.

### Test 5 — Detects failure to block non-moderators from the moderator page
1. Log in with `[TEST_EMAIL]` / `[TEST_PASSWORD]` (a regular user).
2. Verify you stay on the login page ("Login successful!") and are not sent to the moderator page.
3. Open `[APTITUDE_BASE_URL]/#/moderator` directly.
4. Verify "Moderator access required" is shown and no requests are listed.

---

## Backend: Moderator Approval (#104)

Setup: create two pending requests with Backend Admin Registration Test 1 (use two different emails). Call their ids `<A>` and `<B>`. All requests below need the moderator's PHPSESSID unless the card says otherwise.

### Test 1 — Detects failure to return pending admin requests
1. In Postman, GET `[APTITUDE_BASE_URL]/moderator_requests.php` with the moderator's PHPSESSID.
2. Verify the HTTP status is 200.
3. Verify `requests` contains `<A>` with `status` `"pending"`, `full_name`, `business_name`, and a `proof_of_ownership_url` field.
4. After running Test 2, send the request again and verify `<A>` is no longer included.

### Test 2 — Detects failure to approve a request and create the admin account
1. In Postman, POST `[APTITUDE_BASE_URL]/moderator_approve.php` with raw JSON `{"request_id":<A>,"action":"approve"}`.
2. Verify the HTTP status is 200.
3. Verify the response is `{"success":true,"request_id":<A>,"status":"approved"}`
4. In phpMyAdmin, verify `users` now has a row with `username` = request `<A>`'s email and `role = 'admin'`.
5. Verify request `<A>` in `admin_requests` has `status = 'approved'`.
6. Log in on `[APTITUDE_BASE_URL]` with request `<A>`'s email and password. Verify "Login successful!" and no redirect to the moderator page.
7. Send step 1 again. Verify 409 (the request was already reviewed).

### Test 3 — Detects failure to deny a request and delete it
1. In Postman, POST `[APTITUDE_BASE_URL]/moderator_approve.php` with raw JSON `{"request_id":<B>,"action":"deny"}`.
2. Verify the HTTP status is 200.
3. Verify the response is `{"success":true,"request_id":<B>,"status":"denied"}`
4. In phpMyAdmin, verify request `<B>` no longer exists in `admin_requests`.
5. Verify `users` has **no** row for request `<B>`'s email.
6. In FileZilla, verify `<B>`'s uploaded document was removed from `ayushstuff/karavan_uploads`.
7. Log in with request `<B>`'s email and password. Verify "Invalid username or password."

### Test 4 — Detects failure to block a non-moderator from approving requests
1. Create a new pending request `<C>` (Backend Admin Registration Test 1).
2. Log in with `[TEST_EMAIL]` / `[TEST_PASSWORD]` (a regular user) and get that PHPSESSID.
3. In Postman, POST `[APTITUDE_BASE_URL]/moderator_approve.php` with `{"request_id":<C>,"action":"approve"}` and the regular user's cookie.
4. Verify the HTTP status is 403.
5. Verify the response is exactly `{"success":false,"error":"You do not have permission to perform this action."}`
6. Verify `<C>` is still `pending` in `admin_requests` and no `users` row was created for its email.
7. Repeat steps 3–5 with no cookie at all, and with the cookie of the admin approved in Test 2. Verify both also get 403.
