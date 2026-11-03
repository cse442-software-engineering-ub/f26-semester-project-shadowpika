# Community shopping: user stories and task cards

`[APTITUDE_BASE_URL]` = `https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/ayushstuff`

Use any student account you can log in with as `[TEST_EMAIL]` / `[TEST_PASSWORD]` (e.g. one made with "Sign up"). `[YOUR_ID]` is that account's `id` in the `users` table.

**One-time setup** (phpMyAdmin → `cse442_2026_fall_team_j_db` → SQL tab, in this order):
1. `database/migrations/006_listing_communities.sql` if `listings` has no `community` column yet.
2. `database/migrations/008_community_members.sql`. It creates the `community_members` table and copies everyone's old single community (`users.community_id`) into it.
3. `database/seeds/all_of_ub_community.sql` (approved community 91070 "All of UB").
4. `database/seeds/community_shopping_test.sql`. It adds the approved communities "Shopping Test Hall" (91080) and "Shopping Test Annex" (91081), with one active item each: "Hall Test Lamp" (95001) and "Annex Test Kettle" (95002).

**Reset between tests:** `DELETE FROM community_members WHERE user_id = [YOUR_ID];` This puts the account back in All of UB only, shopping from All of UB.

**How it works:**
- Every listing belongs to one community through `listings.community`.
- `community_members` stores which communities each user joined, and `shopping = 1` marks the ones they shop from.
- Everyone is automatically a member of All of UB and can't leave it. A row for All of UB only exists to remember "not shopping from it".
- Owners always see their own items.

---

## User story 1: Choose the communities I shop from

**As a** shopper,
**I want** to choose which of my communities I shop from,
**so that** search only shows items from the communities I care about right now.

### Acceptance criteria

1. I can join as many approved communities as I like from the navigation bar, and leave any of them except All of UB.
2. The search page has a "Shopping from" section with a checkbox for All of UB and for each community I joined, and none for communities I didn't join.
3. Unticking or ticking a community saves the choice on the server and immediately updates the results. The choice is still there after I log out and back in.
4. At least one community always stays ticked. If I leave every community I was shopping from, I fall back to shopping from All of UB.
5. A community I just joined is ticked automatically.

## User story 2: Members-only community items

**As a** community administrator,
**I want** shoppers to only see items from communities they are part of,
**so that** people outside my community can't shop my community's items.

### Acceptance criteria

1. Search only returns items from communities the shopper is a member of (and is shopping from), plus nothing at all to someone who isn't logged in.
2. Opening an item from a community you aren't in, by link or by typing its id, shows "This item is only available to members of its community." and no Buy Now or Save button.
3. A non-member can't save the item to favorites or send a meeting request for it, even by calling the API directly.
4. If I leave a community, its items disappear from my search and favorites, and come back if I rejoin.
5. A seller always sees their own items.

---

## Frontend: Choose communities to shop from (Story 1)

Automated: `frontend/src/__tests__/CommunityShopping.test.jsx` ("Story 1") and `frontend/src/__tests__/JoinCommunity.test.jsx` (`npm test` in `frontend`).

### Test 1 — Detects failure to join more than one community
1. Reset (see above), log in with `[TEST_EMAIL]` / `[TEST_PASSWORD]` and open `[APTITUDE_BASE_URL]/home.html`.
2. Click "Join a Community" in the navigation bar.
3. Verify All of UB says "Everyone is a member" and has no Leave button.
4. Click "Join" next to Shopping Test Hall. Verify the dialog closes and the navigation button now says "Shopping Test Hall".
5. Click it again (its tooltip is "Manage communities") and join Shopping Test Annex.
6. Verify the navigation button says "2 Communities", and in the dialog both show "Joined" and a Leave button.

### Test 2 — Detects failure to show only my communities in "Shopping from"
1. After Test 1, open `[APTITUDE_BASE_URL]/product-search.html`.
2. Verify the "Shopping from" section has ticked checkboxes for All of UB, Shopping Test Hall and Shopping Test Annex, and no other community.
3. Verify "Hall Test Lamp" and "Annex Test Kettle" are both in the results, along with the All of UB test items.

### Test 3 — Detects failure to filter results when I untick a community
1. On the search page from Test 2, open DevTools → Network.
2. Untick "Shopping Test Annex".
3. Verify a POST to `set_shopping_communities.php` has the body `{"community_ids":[91070,91080]}` and returns 200.
4. Verify "Annex Test Kettle" disappears from the results without reloading, and "Hall Test Lamp" stays.
5. Log out, log back in and open the search page. Verify Shopping Test Annex is still unticked.
6. Tick it again and verify "Annex Test Kettle" comes back.

### Test 4 — Detects failure to keep at least one community selected
1. On the search page, untick everything except Shopping Test Hall.
2. Verify the Shopping Test Hall checkbox is greyed out and can't be unticked.
3. Verify the results only contain "Hall Test Lamp".

### Test 5 — Detects failure to fall back to All of UB after leaving
1. After Test 4 (only Shopping Test Hall ticked), click "Join a community" in the "Shopping from" section.
2. Verify the community dialog opens. Click "Leave" next to Shopping Test Hall.
3. Verify the dialog stays open, Shopping Test Hall shows "Join" again, and the navigation button says "Shopping Test Annex".
4. Close the dialog. Verify "Shopping from" no longer lists Shopping Test Hall, All of UB is ticked again, and "Hall Test Lamp" is gone from the results.

### Test 6 — Detects failure to show an error when saving fails
1. On the search page with at least two communities ticked, open DevTools → ⋮ → More tools → **Network request blocking**, enable it and add the pattern `*set_shopping_communities.php*`.
2. Untick one of the ticked communities.
3. Verify "Could not update your communities. Please try again." appears under the checkboxes, the box is still ticked, and the results don't change.
4. Remove the blocking pattern.

---

## Frontend: Hide items from other communities (Story 2)

Automated: `frontend/src/__tests__/CommunityShopping.test.jsx` ("Story 2").

### Test 1 — Detects failure to block a non-member from an item page
1. Reset, so you are only in All of UB.
2. Open `[APTITUDE_BASE_URL]/item.html?listing_id=95001` directly.
3. Verify the page shows "This item is only available to members of its community." and no Buy Now or Save to Favorites button.
4. Verify searching for "Hall Test Lamp" on the search page finds nothing.

### Test 2 — Detects failure to show the item once I join
1. Join Shopping Test Hall from the navigation bar.
2. Open `[APTITUDE_BASE_URL]/item.html?listing_id=95001` again.
3. Verify the item details, Buy Now and the heart button are shown.
4. Click the heart to save it, then open Favorites and verify "Hall Test Lamp" is listed.

### Test 3 — Detects failure to hide saved items after leaving
1. After Test 2, leave Shopping Test Hall.
2. Open Favorites and verify "Hall Test Lamp" is no longer listed.
3. Join Shopping Test Hall again and verify it is back in Favorites.

---

## Backend: Joining, leaving and choosing communities (Story 1)

Automated: `tests/backend/Unit/CommunitiesTest.php` and the community tests in `tests/backend/Http/EndpointsHttpTest.php` (`vendor/bin/phpunit`).

In Postman, POST `[APTITUDE_BASE_URL]/login.php` with raw JSON `{"email":"[TEST_EMAIL]","password":"[TEST_PASSWORD]"}`. Postman keeps the `PHPSESSID` cookie for the later requests. Reset before Test 1.

### Test 1 — Detects failure to list communities with membership flags
1. GET `[APTITUDE_BASE_URL]/list_communities.php`.
2. Verify 200 with `"success":true` and a `communities` list where each entry has `community_id`, `name`, `joined`, `shopping` and `automatic`.
3. Verify All of UB is `{"community_id":91070,"name":"All of UB","joined":true,"shopping":true,"automatic":true}` and Shopping Test Hall has `"joined":false,"shopping":false,"automatic":false`.
4. Verify the login response from the setup step had `"communities":[]`.

### Test 2 — Detects failure to join several communities
1. POST `[APTITUDE_BASE_URL]/join_community.php` with `{"community_id":91080}`, then again with `{"community_id":91081}`.
2. Verify both return 200, e.g. `{"success":true,"community_id":91080,"community_name":"Shopping Test Hall"}`.
3. In phpMyAdmin run `SELECT * FROM community_members WHERE user_id = [YOUR_ID];` and verify two rows (91080 and 91081), both with `shopping = 1`.
4. POST `{"community_id":91080}` again and verify 200 with no extra row.
5. POST `{"community_id":999999}` and verify 404 `{"success":false,"error":"Community not found."}`.

### Test 3 — Detects failure to save which communities I shop from
1. After Test 2, POST `[APTITUDE_BASE_URL]/set_shopping_communities.php` with `{"community_ids":[91080]}`.
2. Verify 200 `{"success":true,"shopping_community_ids":[91080]}`.
3. In phpMyAdmin verify 91080 has `shopping = 1`, 91081 has `shopping = 0`, and there is a row for 91070 with `shopping = 0`.
4. GET `list_communities.php` and verify only Shopping Test Hall has `"shopping":true`.

### Test 4 — Detects failure to reject invalid shopping choices
1. POST `set_shopping_communities.php` with `{"community_ids":[]}`. Verify 400 `{"success":false,"error":"Select at least one community to shop from."}`.
2. Reset, then POST `{"community_ids":[91080]}`. Verify 403 `{"success":false,"error":"You can only shop from communities you have joined."}`.
3. POST `{"community_ids":"91080"}`. Verify 400 `{"success":false,"error":"community_ids must be a list of community ids."}`.
4. Verify `community_members` is unchanged after each one.

### Test 5 — Detects failure to leave one community and fall back to All of UB
1. Join 91080 and 91081, then set shopping to `{"community_ids":[91080]}`.
2. POST `[APTITUDE_BASE_URL]/leave_community.php` with `{"community_id":91080}`.
3. Verify 200 `{"success":true,"community_id":91080,"community_name":"Shopping Test Hall"}`.
4. GET `list_communities.php` and verify Shopping Test Annex is still joined, and All of UB is back to `"shopping":true`.
5. POST `leave_community.php` with `{"community_id":91070}` and verify 400 `{"success":false,"error":"Everyone is a member of All of UB, so it can't be left."}`.

### Test 6 — Detects failure to require a login
1. In Postman, delete every cookie for `aptitude.cse.buffalo.edu`.
2. Call `list_communities.php` (GET), and `join_community.php`, `leave_community.php` and `set_shopping_communities.php` (POST).
3. Verify each returns 403 `{"success":false,"error":"You do not have permission to perform this action."}`.
4. GET `set_shopping_communities.php` while logged in and verify 405.

---

## Backend: Members-only listings (Story 2)

Automated: `tests/backend/Unit/CommunitiesTest.php`, `testItemDetailsAreOnlyShownToMembersOfTheListingsCommunity` in `tests/backend/Http/EndpointsHttpTest.php`, and `tests/backend/Http/ItemDetailsHttpTest.php`. Search uses mysqli, so it is only tested here and in the frontend tests.

Log in with Postman and reset before Test 1.

### Test 1 — Detects failure to hide other communities' items from search
1. GET `[APTITUDE_BASE_URL]/api/search_listings.php?q=Test`.
2. Verify 200, and neither "Hall Test Lamp" nor "Annex Test Kettle" is in `results`.
3. Join 91080 and GET it again. Verify "Hall Test Lamp" is listed and "Annex Test Kettle" is not.
4. Set shopping to `{"community_ids":[91070]}` and GET it again. Verify "Hall Test Lamp" is gone.

### Test 2 — Detects failure to block item details for non-members
1. Reset. GET `[APTITUDE_BASE_URL]/api/get_item_details.php?listing_id=95001`.
2. Verify 403 `{"success":false,"error":"This item is only available to members of its community."}`.
3. GET `?listing_id=91001` (an All of UB item) and verify 200.
4. Join 91080 and GET `?listing_id=95001` again. Verify 200 with `"name":"Hall Test Lamp"`.
5. Run `UPDATE listings SET owner_id = [YOUR_ID] WHERE listing_id = 95002;`, then GET `?listing_id=95002` without joining 91081. Verify 200 (owners always see their own item). Set `owner_id` back to `NULL` afterwards.

### Test 3 — Detects failure to block saving and meeting requests for non-members
1. Reset. POST `[APTITUDE_BASE_URL]/api/save_favorite.php` with `{"listing_id":95001}`.
2. Verify 403 `{"success":false,"error":"This item is only available to members of its community."}` and no new row in `favorites`.
3. POST `[APTITUDE_BASE_URL]/api/create_meeting_request.php` with `{"listing_id":95001,"meeting_date":"<a date next week>","meeting_time":"14:00","location_id":<any approved location id>}`.
4. Verify the same 403 and no new row in `meeting_requests`.

### Test 4 — Detects failure to hide saved items after leaving
1. Join 91080 and POST `save_favorite.php` with `{"listing_id":95001}`. Verify 201 (or 200 if already saved).
2. GET `[APTITUDE_BASE_URL]/api/get_favorites.php` and verify "Hall Test Lamp" is listed.
3. POST `leave_community.php` with `{"community_id":91080}` and GET `get_favorites.php` again. Verify it is gone, but the row is still in `favorites`.

### Test 5 — Detects failure to require a login for listings
1. Delete every cookie in Postman.
2. GET `api/search_listings.php` and `api/get_item_details.php?listing_id=91001`.
3. Verify both return 401 `{"success":false,"error":"You must be logged in."}`.
