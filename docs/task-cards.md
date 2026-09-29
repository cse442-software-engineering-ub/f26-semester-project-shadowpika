# Task card acceptance tests (updated to match the built flow)

`[APTITUDE_BASE_URL]` = `https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/ayushstuff`

## What changed from the original cards

- **No notification bell.** Moderators log in on the normal login page and are sent to the moderator page, `[APTITUDE_BASE_URL]/#/moderator`, which lists every pending request.
- **Page URLs use `#/`** (`/#/admin-register`, `/#/moderator`) because Aptitude ignores `.htaccess` rewrites.
- **Applicants have no account until approved.** Approve *creates* a `users` row with `role = 'admin'` (it doesn't update an existing one). Deny *deletes* the request and its document, so there is no "denied" row to look at afterwards.
- **Applying doesn't need a login**, so the "log in and obtain PHPSESSID" step is gone from the admin-register backend cards.
- **Request IDs:** `5001` / `5002` are only guaranteed on a freshly created `admin_requests` table. On Aptitude, IDs keep counting up after every test run, so use the `request_id` the register call returned.

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
4. Upload a valid PDF under 10MB.
5. Click "Submit for Approval."
6. Verify a POST to `admin_register.php` returns 201.
7. Verify "Your request is pending review" is shown on the page.

### Test 3 — Detects failure to block submission when proof-of-ownership is missing
1. Open `[APTITUDE_BASE_URL]/#/admin-register`.
2. Open Developer Tools → Network and clear the log.
3. Fill in every field except the upload.
4. Click "Submit for Approval."
5. Verify no request is sent to `admin_register.php`.
6. Verify the upload control is outlined in red and "Proof of ownership is required." is shown.

### Test 4 — Detects failure to handle a rejected file type
1. Open `[APTITUDE_BASE_URL]/#/admin-register`.
2. Fill in all fields and attach a `.exe` file.
3. Click "Submit for Approval."
4. Verify no request is sent to `admin_register.php` (the page rejects it before sending).
5. Verify the upload control is outlined in red and "Invalid file type. Accepted formats: PDF, JPG, PNG." is shown.
6. Verify no success confirmation is displayed.

### Test 5 — Detects failure to render responsively at mobile size
1. Open `[APTITUDE_BASE_URL]/#/admin-register`.
2. In Chrome DevTools, set the viewport to 390 × 844.
3. Verify all form controls stack vertically in one column.
4. Verify there is no horizontal scrolling and every control is fully visible.

---

## Backend: Admin Registration (#102)

### Test 1 — Detects failure to create a pending admin request with valid data
1. In Postman, create a POST request to `[APTITUDE_BASE_URL]/admin_register.php`. No login is needed.
2. Body → form-data: `full_name=Alex Landlord`, `business_name=Landlord Properties LLC`, `email=alex.landlord@test.com`, `phone=123-456-7890`, `password=Landlord123!`, and a **File** field `proof_of_ownership` with a PDF under 10MB.
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
1. In Postman, POST to `[APTITUDE_BASE_URL]/admin_register.php` with the same fields (a new email) and a `.exe` file as `proof_of_ownership`.
2. Verify the HTTP status is 400.
3. Verify the response is exactly `{"success":false,"error":"Invalid file type. Accepted formats: PDF, JPG, PNG."}`
4. Verify no new row is created in `admin_requests` and no new file appears in `ayushstuff/karavan_uploads` (check in FileZilla).

### Test 4 — Detects failure to block a pending applicant from logging in
1. After Test 1, open `[APTITUDE_BASE_URL]`.
2. Log in with `alex.landlord@test.com` / `Landlord123!`.
3. Verify login fails with "Invalid username or password."

---

## Frontend: Moderator Approval Page (#103)

Setup: submit two applications through `[APTITUDE_BASE_URL]/#/admin-register` (for example, Alex Landlord / Landlord Properties LLC and a second applicant) so at least two requests are pending.

### Test 1 — Detects failure to route a moderator to the pending-request list
1. Open `[APTITUDE_BASE_URL]`.
2. Log in with `[MODERATOR_TEST_EMAIL]` / `[MODERATOR_TEST_PASSWORD]` on the normal login page.
3. Verify the browser goes to `[APTITUDE_BASE_URL]/#/moderator` with the heading "Pending partner requests".
4. Verify the list shows an entry containing "Alex Landlord" and "Landlord Properties LLC".

### Test 2 — Detects failure to display the proof-of-ownership document
1. Log in as the moderator (you land on `[APTITUDE_BASE_URL]/#/moderator`).
2. In Alex Landlord's entry, verify there is a "View proof of ownership" link.
3. Click it.
4. Verify the uploaded document opens in a new tab with no 404 or broken-link error.

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
