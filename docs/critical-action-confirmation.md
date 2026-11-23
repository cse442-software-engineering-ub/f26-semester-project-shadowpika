# #224 / #225 — Confirm critical actions

Confirmed actions include sending a meeting request, canceling or denying a Pending
request, marking a listing Sold, and deleting a listing. Both Sold entry points
(Home's incoming requests and Manage Listings) use the same confirmation design.

| Action | Dialog | Confirm | Return without changing data |
| --- | --- | --- | --- |
| Send meeting | Send this meeting request? | Send Request | Back to Edit |
| Cancel Pending | Cancel this meeting request? | Cancel Request | Keep Request |
| Deny Pending (seller) | Deny this meeting request? | Deny Request | Keep Request |
| Mark Sold | Mark this listing as sold? | Mark as Sold | Keep Listing |
| Delete listing | Delete this listing? | Delete Listing | Keep Listing |

Each dialog identifies the item. Meeting review also shows its date, time,
location and asking/offer price. Back to Edit preserves the original fields,
including the disabled seller location and an entered offer. Delete explains that
the listing and its meeting requests will be permanently removed.

Opening, returning, closing with × or pressing Escape sends no mutation. Initial
focus is on the return button; Tab/Shift+Tab remain inside the native modal.
Controls and Escape dismissal are disabled while submitting. Existing synchronous
mutation guards prevent duplicate requests. The UI waits for server success; a
server/connection error is displayed without claiming success. The existing
successful-send redirect to Home is preserved.

Periodic data reloads continue before confirmation. Cancellation and Sold recheck
their current local record before submitting; the server remains the authority
when data changes between review and the request reaching the server.

## Pause wording

Manage Listings now says **Pause All Listings**. Its existing confirmation uses
**Pause eligible active listings?**, **Pause Listings**, **Pausing…** and the
matching availability messages. The existing API action `freeze_all`, schema
status `inactive`, eligibility rules and response counts are unchanged.

## Existing backend safeguards

Confirmation is a user-interface decision, not an additional authorization flag.
No new `confirmed` parameter, endpoint or database migration is required. Existing
endpoints already enforce the relevant safeguards:

- Creation requires login, another owner's Active listing, community access,
  valid meeting inputs and no duplicate outstanding buyer request.
- Cancellation deletes only the logged-in buyer's Pending request. Approved or
  another buyer's requests are preserved; a repeated cancellation is not another
  success.
- Sold requires the listing owner and both check-ins on the same Approved
  meeting. Both UI entry points send the qualifying request ID. Saved retries
  follow the existing Sold contract.
- Delete requires the listing owner; anonymous/foreign/missing targets are
  rejected. Existing foreign keys remove dependent requests. No server state is
  changed while merely opening a frontend dialog.

Run the related backend checks from the repository root:

```text
php vendor/bin/phpunit --filter 'ManageListingsTest|MeetingSaleTest|MeetingCheckinTest|ListingFreezeTest'
```

These existing tests cover ownership, deletion, status changes, both check-in
orders, same-meeting eligibility, Sold retries and pause restrictions. They use
isolated fixtures, not grading accounts. Additional disposable audit checks for
creation/cancellation were run during implementation. Production backend code
does not need to change for these confirmation dialogs.

## Frontend verification

From frontend:

```text
npm test -- src/__tests__/CriticalActions.test.jsx src/__tests__/ManageListings.test.jsx src/__tests__/MeetingRequests.test.jsx src/__tests__/MeetingProgress.test.jsx src/__tests__/ListingFreeze.test.jsx
```

The focused critical-action tests cover all five operations, both Sold entry
points, every dismissal, default focus/focus cycling, no early POST, duplicate
clicks, loading locks, server refusal, connection failure, preserved form values,
and eligibility changing during an open dialog. Existing regressions now perform
the explicit confirmation before checking mutations.

Browser checks use a separately built production frontend, real Chromium/native
dialogs and isolated API mocks. They check desktop and 390×844 mobile behavior,
keyboard dismissal/focus, pending locks, the saved location/offer payload, the
existing Home redirect and Pause wording. They do not claim a live PHP or grading
data acceptance pass. The normal Repo/deploy upload bundle is not rebuilt until
the source changes have been merged.
