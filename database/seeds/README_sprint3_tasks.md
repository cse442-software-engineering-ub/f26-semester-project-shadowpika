# Sprint 3 backend Task fixtures

Use [sprint3_task_fixtures.sql](sprint3_task_fixtures.sql) to prepare #175, #203
and #206 on **Aptitude or an isolated QA database**. It is not an application
migration or a Cattle User Story reset. Do not upload these SQL/source files as
website content. This seed never creates a login account or copies a password,
token, database dump or real uploaded photo.

## Prerequisites

1. Deploy the merged application, including #175's authenticated/member-only
   publication fix. Apply the current schema/migrations separately: users with
   email/role, approved partners/locations, community membership and join-request
   tables, listings with community/location reference, and meeting_requests with
   **both** arrival columns (including migration 013). The seed lists missing
   columns and blocks without application writes when prerequisites are absent.
2. Register three **ordinary** users through the normal registration page:
   `jia.buyer@test.com`, `jia.seller@test.com`, `jia.outsider@test.com`. Retain their
   actual login details separately. Each email must resolve uniquely, and their
   IDs must be distinct. For a separate QA set, change the three email settings
   at the top of a local copy of the SQL to the manually registered QA accounts.
3. Buyer and outsider must not have joined/administer Keller. They may retain
   automatic Karavan membership. The seed never changes memberships, approvals,
   shopping preferences or existing accounts. Publisher membership negative tests
   use the buyer; seller Keller membership is not necessary for fixture setup.
4. Back up the intended database and ensure nobody is consuming these fixtures
   during preparation. The SQL's advisory lock serializes seed imports only;
   it does not lock out the application. Execute the complete file in one connection.

## Import and interpretation

Select the intended database in phpMyAdmin, then **Import** the complete file.
Do not run other seed files or paste just its INSERT statements. Stop on a SQL
error and roll back an open transaction. SQL cannot distinguish Aptitude from
Cattle when both use the same database name: verify the server in the browser.

- `fixture_preflight = READY` permits missing records to be inserted.
- `fixture_result = PASS...` means 11 fixture listings and seven unused meetings
  were resolved successfully. That is **data preparation**, not acceptance-test success.
- `BLOCKED...` lists conflicts, missing/duplicate accounts, changed approvals,
  moved/duplicate pins or consumed data. It is not a request to delete/reset data.
- A matching rerun preserves rows, IDs, image URLs, descriptions, timestamps and
  next-ID counters. New records allocate their own IDs normally. It never UPDATEs
  or DELETEs application rows. Arbitrary records from other owners remain untouched.
- A checked-in, Sold, inactive or otherwise inconsistent fixture blocks every
  application write. Preserve it; use an isolated DB or separately registered QA
  accounts/fixtures for another full run. Do not clear arrival timestamps or undo Sold.
- The name `Unapproved QA Community` must be absent from the approved set. No
  pending registration is required merely to test rejection of that name.

The final result sets provide account IDs, four point IDs/coordinates, and the
actual listing/request mappings. Save these results with the test run. IDs are
resolved by email, owner, exact name and association; no production IDs are inserted.

## Records and expected initial state

All ten dedicated items belong to the resolved seller and use Karavan, Good
condition and active status. Existing photos and user-entered purposes are kept.
On a new database their image_url is NULL, which is valid for API/map fixtures;
frontend mock tests explicitly allow a fallback cover. #175 still uploads a valid
local image during its own publication test, independently of these saved images.

| Variable | Item | Price/category | Location | Meeting, America/New_York |
| --- | --- | --- | --- | --- |
| map_main_id | Matthew’s Album | 442 / Other | Baldy 19 | None |
| map_union_id | Wooden Study Desk | 40 / Dorm Living | Student Union Main Entrance | None |
| map_legacy_id | Black Desk Lamp | 10 / Dorm Living | label NULL / ID NULL | None |
| qa_success_id | Study Lamp | 12 / Dorm Living | Baldy 19 | Nov 6 2026, noon, approved |
| qa_seller_first_id | Science Textbook Bundle | 10 / Textbooks | Baldy 19 | Nov 6 2026, noon, approved |
| qa_far_id | Graphing Calculator | 40 / Tech & Electronics | Capen | Nov 6 2026, noon, approved |
| qa_accuracy_id | Reading Lamp | 10 / Dorm Living | Baldy 19 | Nov 6 2026, noon, approved |
| qa_stale_id | Desk Organizer | 8 / Dorm Living | Baldy 19 | Nov 6 2026, noon, approved |
| qa_future_id | Backpack | 15 / Clothing & Gear | Baldy 19 | Dec 18 2026, 2 PM, approved |
| qa_pending_id | Notebook Set | 5 / Other | Baldy 19 | Nov 6 2026, noon, pending |
| keller_listing_id | Mini Fridge | 80 / Dorm Living | Keller Properties LLC | None; read-rejection only |

The Mini Fridge is an intentional **legacy fixture with owner NULL**, matching
the shared Aptitude record used for #203's 403 test. It is not an example of a
valid publication through the newly protected endpoint. Reuse one uniquely
matching existing legacy item, retaining all its fields, including Keller HQ
text/NULL location reference. If absent, insert a separate legacy fixture with
Bill's association. Never change or take ownership of a shared item. Multiple
matching legacy records block rather than picking an arbitrary one.

Only missing exact approved Karavan/Keller records are seeded, using the same
non-login partner-row pattern as `all_of_ub_community.sql`. No administrator user
or fake applicant approval is created. Existing pending/name-conflicting partners
require review. The seed preserves all existing partner rows and points. Required
points are Baldy 19 (43.000410, -78.787090), Student Union (43.001054, -78.786087),
Capen (43.000822, -78.789203) and Keller's Bill (43.000881, -78.787572).

All seven meetings have the resolved buyer, seller-owned listing and explicit
location association. Both arrival timestamps start NULL. The normal window is
**November 6, 2026, 11:45 AM–2 PM New York**; future opens **December 18 at 1:45 PM**.
After these dates, prepare and document separate future fixtures; do not change
the shared server clock or reschedule the formal records behind the test text.

## Configure the Cards/Postman from output

Current Task cards contain the confirmed Aptitude snapshot, not universal IDs.
Before running those cards elsewhere, replace **every corresponding reference**
within the relevant card with the seed output, including expected values and
literal request bodies; setting Postman variables alone does not replace literals.

- Accounts: buyer 222, seller 223, outsider 224 are the current snapshot only.
- Points: Baldy 91004, Student Union 91002, Capen 91001, Bill 91011 and Keller
  community 5016 are current snapshot values. Read actual output for a new DB.
- #203: set map_main_id, map_union_id, map_legacy_id and keller_listing_id to their
  **listing_id** values. Set missing_listing_id=2147483647 after absence is
  confirmed; the seed blocks if that ID is occupied. Use emitted point IDs too.
- #206: qa_* variables are **request_id**, not listing_id. Record both IDs.
  Current pairs are 91126/95042, 91127/95043, 91128/95044, 91129/95045,
  91130/95046, 91131/95047, 91132/95048. Replace those literal pairs in payloads
  and assertions with the new output, including both Sold request bodies.
- #202: if using a different map_main_id, update its item-page entry, captured
  URL, example listing_id and assertions consistently; the mocked coordinates
  remain those printed in the card. Never edit a real point to match a mock.
- #174/#205 synthetic IDs such as 9901741 and 9902051 remain synthetic. Confirm
  they are inaccessible as stated; never insert real rows with those IDs. Adjust
  a mocked owner_id to the actual seller ID if needed, but do not replace dummy
  requests with real grading meetings.
- #175's publication creates its own run-specific item; save the returned ID.
  Nonmember tests use valid Keller/Bill data, so a location mismatch cannot
  masquerade as a membership rejection. #203 uses buyer; #206 outsider is neither
  participant. Each manual test independently logs in and logs out.

For the already prepared Aptitude records, do not rebuild them just to demonstrate
this seed. A clean isolated DB proves reproducibility without consuming grading data.

## Local verification and maintenance

Build schema-compatible disposable MySQL, then run:

```powershell
$env:KARAVAN_FIXTURE_TEST_DSN='mysql:host=127.0.0.1;port=33331'
php tests/mysql/sprint3_task_fixtures_test.php
```

This test requires a disposable loopback MySQL server with root/empty password;
it allocates and drops only randomly named test databases. It imports no live
dump data or credentials. Coverage includes new creation, different account IDs,
unrelated records, existing photos/descriptions/shared item preservation, repeated
execution, incomplete schema, duplicate/missing accounts, membership conflicts,
wrong pins, extra meetings, changed approvals, arrivals and Sold preservation.
It also runs the existing check-in business logic against the generated meetings.

Regenerate SQL after changing its source:

```powershell
node scripts/build/generate-sprint3-task-seed.mjs
```

Commit the generated SQL, this README, generator and regression test together.
Once merged, link the SQL and this README from #175/#203/#206 Test Setup. Do not
claim a branch-only link exists on dev before merge, or that data setup proves
the live acceptance tests passed.
