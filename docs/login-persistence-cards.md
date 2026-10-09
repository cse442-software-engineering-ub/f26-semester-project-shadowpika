# Login blocking and persistent login: user story and task cards

`[APTITUDE_BASE_URL]` = `https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/ayushstuff`

Use any account you can log in with as `[TEST_EMAIL]` / `[TEST_PASSWORD]` (e.g. one made with "Sign up"), and `mod@test.com` / `Moderator123!` as the moderator.

**One-time setup:** run `sql/005_auth_tokens.sql` in phpMyAdmin's SQL tab for `cse442_2026_fall_team_j_db`. It creates the `auth_tokens` table. Without it logging in still works, but the login is forgotten when the browser closes.

**"Closing the browser" in these tests:** Chrome's "Continue where you left off" setting brings session cookies back, so instead of closing Chrome, open DevTools → Application → Cookies → `aptitude.cse.buffalo.edu` and delete **only** `PHPSESSID`. That is exactly what closing the browser (or Aptitude clearing an idle session) does.

---

## User story: Stay logged in

**As a** student or community partner who has logged in to Karavan,
**I want** to stay logged in for 30 days, even after I close my browser,
**so that** opening Karavan takes me straight to the home page instead of the login form, while nobody who isn't logged in can see the marketplace pages.

### Acceptance criteria

1. Someone who isn't logged in who opens any page except Log In, Sign Up, the Community Partner form or the 404 page is sent to the login page, and the page is never shown (no flash of content, and the navigation bar never appears).
2. After logging in, closing the browser and coming back within 30 days opens the home page without logging in again.
3. A logged-in user who opens the login or sign-up page is sent to the home page; a moderator is sent to the moderator page.
4. Logging out ends the login everywhere on that browser: protected pages are blocked again, Back doesn't show them, and the old cookie can't log back in.
5. The login cookie can't be read by JavaScript, and the database only stores a hash of it.
6. A login older than 30 days, or a tampered cookie, is rejected and the visitor has to log in again.

---

## Frontend: Block pages when logged out

Automated: `karavan-login/src/__tests__/RequireLogin.test.jsx` (`npm test` in `karavan-login`).

### Test 1 — Detects failure to show a page to a logged-in user
1. Log in at `[APTITUDE_BASE_URL]` with `[TEST_EMAIL]` / `[TEST_PASSWORD]`.
2. Open each of these: `home.html`, `product-search.html`, `sell.html`, `settings.html`, `profile.html`.
3. Verify each page loads with the navigation bar and stays on its own URL.

### Test 2 — Detects failure to block a logged-out visitor
1. Open a private/incognito window (nobody is logged in).
2. Open DevTools → Network.
3. Open `[APTITUDE_BASE_URL]/home.html`.
4. Verify a GET to `session.php` returns 401 with `{"success":false,"logged_in":false,"error":"You are not logged in."}`.
5. Verify the browser ends on the login page (`[APTITUDE_BASE_URL]/`) and the home page content and navigation bar were never shown.
6. Repeat steps 3–5 with `product-search.html`, `sell.html`, `settings.html`, `profile.html`, `item.html?id=1`, `meet.html?listing_id=1` and `#/moderator`.
7. Verify `[APTITUDE_BASE_URL]/register.html`, `[APTITUDE_BASE_URL]/#/admin-register` and `[APTITUDE_BASE_URL]/404.html` still open without logging in.

### Test 3 — Detects failure to block a page after logging out
1. Log in with `[TEST_EMAIL]` / `[TEST_PASSWORD]` and open `[APTITUDE_BASE_URL]/sell.html`.
2. Log out.
3. Press the browser's Back button.
4. Verify you end on the login page, not the Sell page.
5. Open `[APTITUDE_BASE_URL]/home.html` directly and verify it also goes to the login page.

---

## Frontend: Go straight home when already logged in

Automated: the "Persistent login" tests in `karavan-login/src/__tests__/Login.test.jsx`.

### Test 1 — Detects failure to skip the login form for a logged-in user
1. Log in with `[TEST_EMAIL]` / `[TEST_PASSWORD]`.
2. Open `[APTITUDE_BASE_URL]/` (the login page) again.
3. Verify you are sent to `home.html` without seeing the login form.
4. Open `[APTITUDE_BASE_URL]/register.html` and verify you are sent to `home.html` too.
5. Delete only the `PHPSESSID` cookie (see "Closing the browser" above) and open `[APTITUDE_BASE_URL]/` again.
6. Verify you are still sent to `home.html`, and a new `PHPSESSID` cookie appears.

### Test 2 — Detects failure to send a logged-in moderator to the moderator page
1. Log in with `mod@test.com` / `Moderator123!`.
2. Open `[APTITUDE_BASE_URL]/` again.
3. Verify you are sent to `[APTITUDE_BASE_URL]/#/moderator`.

### Test 3 — Detects failure to show the login form to a logged-out visitor
1. Open a private/incognito window and go to `[APTITUDE_BASE_URL]/`.
2. Verify the login form (Email, Password, "Log In") is shown and the page stays on the login URL.

---

## Backend: Persistent login

Automated: the "Persistent login backend" tests in `tests/Http/EndpointsHttpTest.php` and `tests/Unit/AuthTest.php` (`vendor/bin/phpunit`).

In Postman, POST `[APTITUDE_BASE_URL]/login.php` with raw JSON `{"email":"[TEST_EMAIL]","password":"[TEST_PASSWORD]"}`. Postman keeps the cookies for the later requests; view or delete them with **Cookies** under the Send button.

### Test 1 — Detects failure to issue a 30-day remember-me cookie
1. Log in with Postman as above.
2. Verify the response sets a `karavan_remember` cookie that expires 30 days from now and is marked `HttpOnly` and `SameSite=Lax`.
3. In phpMyAdmin, open the `auth_tokens` table and find the newest row.
4. Verify `user_id` is your account, `selector` matches the part of the cookie before the `:`, and `token_hash` is a 64-character hash that is **not** the part of the cookie after the `:`.

### Test 2 — Detects failure to report the logged-in user
1. After Test 1, GET `[APTITUDE_BASE_URL]/session.php`.
2. Verify the status is 200 and the body is `{"success":true,"logged_in":true,"user_id":<your id>,"username":"<your username>","email":"[TEST_EMAIL]","role":"user"}`.

### Test 3 — Detects failure to reject a visitor who isn't logged in
1. In Postman, delete every cookie for `aptitude.cse.buffalo.edu`.
2. GET `[APTITUDE_BASE_URL]/session.php`.
3. Verify the status is 401 and the body is `{"success":false,"logged_in":false,"error":"You are not logged in."}`.

### Test 4 — Detects failure to restore the login after the browser closes
1. Log in with Postman, then delete only the `PHPSESSID` cookie.
2. GET `[APTITUDE_BASE_URL]/session.php`.
3. Verify the status is 200 with `"logged_in":true`, and the response sets a new `PHPSESSID` cookie.
4. GET `[APTITUDE_BASE_URL]/list_communities.php` and verify it returns 200 (endpoints that use the session work again).

### Test 5 — Detects failure to reject a tampered cookie
1. Log in with Postman, then delete the `PHPSESSID` cookie.
2. Edit the `karavan_remember` cookie and change the last character after the `:`.
3. GET `[APTITUDE_BASE_URL]/session.php`.
4. Verify the status is 401 and the response deletes the `karavan_remember` cookie.

### Test 6 — Detects failure to reject a login older than 30 days
1. Log in with Postman, then delete the `PHPSESSID` cookie.
2. In phpMyAdmin, run `UPDATE auth_tokens SET expires_at = '2020-01-01 00:00:00' WHERE user_id = <your id>;`
3. GET `[APTITUDE_BASE_URL]/session.php`.
4. Verify the status is 401 and your rows are gone from `auth_tokens`.

### Test 7 — Detects failure to end the remembered login on logout
1. Log in with Postman and copy the `karavan_remember` cookie value.
2. POST `[APTITUDE_BASE_URL]/logout.php`.
3. Verify the status is 200 with `{"success":true}`, the response deletes `karavan_remember`, and your row is gone from `auth_tokens`.
4. Add the copied `karavan_remember` cookie back by hand and GET `[APTITUDE_BASE_URL]/session.php`.
5. Verify the status is 401.
