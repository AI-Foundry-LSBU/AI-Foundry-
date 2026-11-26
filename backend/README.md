# AI Foundry backend

This guide sets up a local database and runs the API for opportunities and project delivery. Run the first-time steps once on each computer.

## Update an existing checkout for password login

Stop the backend with Ctrl+C. From the project folder run:

```bash
cd backend
npm ci
npm run auth:configure
npm run db:migrate
npm run db:seed
npm start
```

Keep your existing `.env`. The configure command adds a random session signing
secret and four random passwords to it without changing your database URLs or
existing passwords. The migration renames the old demo usernames and keeps the
same user IDs, opportunities, assessments, projects and benefits.

These changes include separate SCRUM-75, SCRUM-76 and SCRUM-77 commits. Apply all
three before checking sign-in in the browser.

## Start it after the first setup

If you have already completed the first-time setup, make sure PostgreSQL is running. On a Mac with Postgres.app, open the app to check. Open Terminal or PowerShell in the project folder and run:

```bash
cd backend
npm start
```

Wait for `AI Foundry API listening at http://127.0.0.1:3000/api/v1`. Leave this Terminal window open. Press **Ctrl+C** when you want to stop the backend.

## First-time setup

### 1. Install the tools

You need **Node.js 22.21 or later**, npm, and **PostgreSQL 16 or later**. Check Node.js and npm in Terminal or PowerShell:

```bash
node -v
npm -v
```

If needed, install [Node.js 24 LTS](https://nodejs.org/en/download). Then install and start PostgreSQL.

- **Mac:** Install [Postgres.app](https://postgresapp.com/downloads.html). Open the downloaded file, drag Postgres.app into Applications, then open the app and click **Initialize**. Wait for PostgreSQL to start.
- **Windows:** Use the [PostgreSQL Windows installer](https://www.postgresql.org/download/windows/). Keep port `5432` for the sample settings below and remember the administrator password you set for `postgres`.

### 2. Create the project's local database

On a Mac with Postgres.app, open Terminal and run:

```bash
"/Applications/Postgres.app/Contents/Versions/latest/bin/psql" -h 127.0.0.1 -p 5432 -d postgres
```

On Windows, open **SQL Shell (psql)** from Start. For a standard install, use `localhost` for the server, `postgres` for the database, `5432` for the port, and `postgres` for the username. Enter the administrator password you set during installation. With another PostgreSQL installation, use its administrator account to open a SQL prompt.

At the SQL prompt, run these two lines. The first creates a login for the backend. The second creates the database and makes that login its owner.

```sql
CREATE ROLE ai_foundry LOGIN PASSWORD 'local_demo_password';
CREATE DATABASE ai_foundry OWNER ai_foundry;
```

You should see `CREATE ROLE` and `CREATE DATABASE`. Type `\q` and press Enter to return to your shell. If your shell window closes, open a new one.

### 3. Install the backend and create your settings file

Open your local project folder in Terminal or PowerShell. This is the folder that contains `backend` and `frontend`. On a Mac, type `cd` followed by a space, drag the project folder from Finder into Terminal, and press Enter.

```bash
cd backend
npm ci
```

If you don't already have a `.env` file in `backend/`, copy the example.

- **Mac or Linux:** `cp .env.example .env`
- **Windows PowerShell:** `Copy-Item .env.example .env`

Each teammate creates their own `.env` on their own computer. If you followed the database setup above, the sample settings already match. If you use a different database login, name, password or port, update both database URLs in your local `.env`.

### 4. Create the tables, add demo users and start the API

While still in `backend/`, run these lines one at a time.

```bash
npm run auth:configure
npm run db:migrate
npm run db:seed
npm start
```

The migration creates the `users` and `opportunities` tables. The seed command adds the demo users. You can repeat these two commands without duplicating the tables or the users. After `npm start`, keep that window open while you test.

## Accounts and passwords

The usernames below belong only to this coursework website. They do not create
LSBU mailboxes, send email, or use university passwords.

| Username | Role | Password in your private backend/.env |
| --- | --- | --- |
| staff@lsbu.ac.uk | Staff | DEMO_STAFF_PASSWORD |
| staff2@lsbu.ac.uk | Second Staff user | DEMO_STAFF2_PASSWORD |
| manager@lsbu.ac.uk | Digital Project Manager | DEMO_MANAGER_PASSWORD |
| engineer@lsbu.ac.uk | AI Foundry Engineer | DEMO_ENGINEER_PASSWORD |

Open `backend/.env` in your editor to find the generated values after the `=`
sign. On a Mac, run `open -e .env` while inside `backend/`. Enter the matching
email and password on the sign-in page. There is no public registration.

Each teammate runs setup against their own local database and gets their own
random passwords. To reset one, change its value in `.env` to 12–128 characters
and run `npm run db:seed`. That account's existing sessions will stop working.
Unchanged passwords and user IDs are preserved when seeding is repeated.

A database password in DATABASE_URL is separate from these website passwords.
Do not share your complete `.env` or commit it. Share only the required demo
credentials privately if teammates use the same running instance.

## Check the API

`X-User-Email` is no longer accepted as authentication. All existing API endpoints
require the session cookie. Writes also require `X-CSRF-Token`. The website
handles both automatically after SCRUM-77.

For a direct API client, call `GET /api/v1/auth/csrf`, retain the cookie, and send
the returned token in `X-CSRF-Token` with `POST /api/v1/auth/login` and JSON
`{ "email": "staff@lsbu.ac.uk", "password": "YOUR_LOCAL_PASSWORD" }`. Retain the
new cookie and CSRF token from login. `GET /api/v1/auth/me` restores the current
user; `POST /api/v1/auth/logout` destroys the session.

Run `npm test` from `backend/` with PostgreSQL running. TEST_DATABASE_URL must
point to a local database in which the test user can create schemas. Tests use
isolated schemas and their own fixture passwords, never your demo password
values. They cover authentication and the existing US01–US06 APIs.

## Check the Sprint 1 workflow in the browser

Keep PostgreSQL and the backend running. Open a second terminal in the project folder and run:

```bash
cd frontend
npm ci
npm run dev
```

Run `npm ci` the first time or after a dependency change. Open the **Local** address printed by Vite.

1. Sign in with `staff@lsbu.ac.uk`.
2. Open **Submit Opportunity**, fill in the form, and submit it. The reference on the confirmation screen is the ID of the saved database row.
3. Open **My Opportunities**, refresh the page, and open the saved request. Check that its reference and details match the submission.
4. To check access, copy the detail URL, sign out, and sign in with `staff2@lsbu.ac.uk`. The first user's request should be absent from this list, and opening the copied URL should show **Access restricted**.

Vite forwards local API requests to `http://127.0.0.1:3000` by default. If you run the backend on a different port, set `AI_FOUNDRY_API_TARGET` to its URL before starting Vite. The staff submission, list, detail, and deletion actions use the API. The seeded manager account uses the API for assessment and decisions. The manager and engineer use the API for Project Delivery.

## Try the manager queue, assessment and decision

On an existing database, run `npm run db:migrate` from `backend/` to add the assessments and decisions tables, then restart the API.

1. Submit an opportunity as `staff@lsbu.ac.uk`.
2. Sign out and sign in as `manager@lsbu.ac.uk`. Open **All Opportunities** and select the new request.
3. Rate all five criteria, choose a manual priority, and optionally enter a category and notes. Select **Save Assessment**.
4. Refresh the page. The ratings and priority should remain, and the request should show **Under Review**.
5. Enter a decision reason, choose **Approve Opportunity** or **Reject**, then select **Save Decision**. A reason is required for rejection and optional for approval.
6. Sign back in as the submitting staff user. Check the updated status and the saved reason in **My Opportunities**.

Sign out and use the Manager account to assess requests. Account roles are assigned in the database. Sign-in reads the role returned by the API; there is no role preview menu.

## Try Project Delivery (US04)

On an existing database, run `npm run db:migrate` from `backend/`, then restart
the backend. The migration creates `projects` and `project_progress_notes`.
It preserves existing opportunities and assessments.

1. As `manager@lsbu.ac.uk`, open an approved opportunity and select **Move to Project Delivery**. Optionally add planned dates, then select **Create Project**. The project starts as **Not Started**.
2. Sign in as `engineer@lsbu.ac.uk`, open the project in **Project Delivery**, choose **In Progress** or **Testing**, and enter a note. Select **Save Progress** and refresh.
3. Sign in as `manager@lsbu.ac.uk`. Open the same project in **Project Delivery** and confirm the status and note are there.

Each opportunity can have one project. Creating the project preserves the
opportunity and its approval. An opportunity linked to a project cannot be
deleted through the staff deletion action. For the API endpoints and fields,
see [OpenAPI](../docs/api/openapi.yaml).

## Record project benefits (US05)

From `backend/`, run `npm run db:migrate` before restarting the API. Migration
`005_project_benefits.sql` creates the benefits table and preserves existing
opportunities, assessments and projects.

1. Sign in with `manager@lsbu.ac.uk`. Create a delivery project from an approved opportunity if needed.
2. Open **Benefits Reporting**, select **Record Benefit**, and choose a real project.
3. Complete the category, description, measurement, estimated value, actual value, unit and date. Notes are optional. Select **Save Benefit**.
4. Refresh, select **Edit**, change the values, and select **Update Benefit**. Refresh again and reopen the record to check every field.
5. Open the linked project to see its associated benefits. Sign in with `engineer@lsbu.ac.uk` to verify read access. Staff and engineers receive 403 if they attempt to create or edit a benefit through the API.

The API provides `GET /api/v1/benefits`, optional filtering with
`?projectId=...`, `GET /api/v1/benefits/:id`, `POST /api/v1/benefits` and
`PUT /api/v1/benefits/:id`. Write requests use the fields defined in
[OpenAPI](../docs/api/openapi.yaml). Values support zero, negative outcomes and
up to four decimal places. The units match the existing form.

Permissions use the signed-in account and its database role. Passwords and
PostgreSQL sessions replace the old demo-email header.

## Verify opportunity search and filters (US06)

Sign in as `manager@lsbu.ac.uk` and open **All Opportunities**. The website
loads every API page, then combines the controls across the complete list.

1. Check department, priority and status separately, then combine them with a search by title or opportunity reference.
2. Try a title in a different letter case and with spaces around it. It should find the same records.
3. Use a combination with no matching records and check the empty message.
4. Select **Reset filters**. The search should clear and the complete loaded list should return.
5. Test a request from an older department name. The department dropdown includes values from saved records as well as the configured departments.

For API verification, `GET /api/v1/opportunities` supports the existing
`status`, `department` and `priority` query parameters. Each item contains
the fields needed by the website, with priority absent until assessment.
The frontend displays this as **Not set**. The opportunity's approval status
and a project's delivery status are separate fields. The displayed delivery
filters use `deliveryStatus` from the response.

## Benefits summary API (US07 backend)

`GET /api/v1/benefits/summary` returns data for a benefits dashboard. It requires
a signed-in Digital Project Manager. Anonymous requests receive 401; staff and
engineer accounts receive 403. Existing benefits list/detail permissions are unchanged.
There are no new dependencies, environment settings or database migrations.

The response contains:

- `totals`: separate `estimated` and `actual` totals for `Hours/month`, `GBP/year`
  and `Cases/month`. Each unit has its own entry, including zero totals if unused.
- `projects`: the same totals for each project with benefits, its ID/title, and
  individual `nonAdditiveBenefits` for `Percent` and `Days` records.
- `totalBenefitsRecorded`, `projectCount` and `byCategory`: counts of distinct
  saved benefits and projects with benefits. `completedProjects` counts all
  completed delivery projects, even those without benefits.
- `message`: `No benefits have been recorded yet.` when there are no records;
  otherwise `null`. An all-zero or percentage-only dataset is not an empty dataset.

Values in this summary are **decimal strings**, for example `"12.5000"`, rather
than JSON numbers. PostgreSQL decimal values are added using integer
ten-thousandths (`BigInt`) so rounding errors do not accumulate. Strings also
preserve large totals beyond JavaScript's safe numeric precision. The existing
US05 record endpoints keep their current numeric response format.

Each benefit ID contributes once. Equal amounts on different IDs are retained;
using `SUM(DISTINCT amount)` would incorrectly discard legitimate records.
Project notes are never joined into the benefit dataset. Percentages need a
shared denominator, and days may represent unrelated durations, so these values
are shown individually without a sum or average. There is no conversion between
units or periods. Each saved row is assumed to represent an independent outcome:
the system cannot infer that two separately entered records describe overlapping
savings. Edit an existing benefit to correct its value rather than adding a
second record for the same outcome.

One database statement reads current benefits and completed-project counts from
the same snapshot. Every request recalculates the summary; no stored totals or
application cache can become stale after an edit or project reassignment.

To check locally:

1. Start the backend and frontend as described above and sign in as the manager.
2. Open **Benefits Reporting** and record a benefit on a real project: estimate
   `12.5`, actual `8.25`, unit `Hours/month`.
3. Open the browser developer console on the running website and run:

   ```js
   fetch('/api/v1/benefits/summary', { credentials: 'same-origin' })
     .then(async response => ({ status: response.status, body: await response.json() }))
     .then(console.log);
   ```

4. Check status 200 and the separate values in `body.totals` and `body.projects`.
   Other saved records also contribute, so totals may exceed the example values.
5. Edit the same benefit, then repeat the request. Values should change without
   increasing `totalBenefitsRecorded`. A browser refresh and a new request should
   give the same saved values.

`src/benefits/summary.js` holds the calculation; `benefitSummaryRecords` in
`src/benefits/queries.js` loads the records; `src/benefits/routes.js` registers the
manager-only endpoint before the `/:id` route. Calculation tests are in
`test/benefits-summary.test.js`; PostgreSQL/API tests are in
`test/benefits-summary-api.test.js`. Run `npm test` with `TEST_DATABASE_URL` set as
described above. The calculation-only tests can run without PostgreSQL:

```bash
node --test test/benefits-summary.test.js
```

These changes implement the two US07 backend tasks. The existing frontend has
not been connected to this endpoint; its dashboard still needs estimated/actual
comparisons and the empty-state message using this response. Loading or
refreshing the dashboard, and refetching after benefit edits, should request a
fresh summary.

## Opportunity history (US08 backend)

After applying the three US08 commits, stop the backend and run this from
`backend/`, then start it again:

```bash
npm run db:migrate
npm start
```

Migration `007_opportunity_history.sql` adds `opportunity_history`. Each entry
stores the opportunity ID, event type, previous/new status, responsible user ID
and name, optional decision reason, event date and source. A timeline index
supports retrieval in chronological order. Existing records are preserved and
the migration runner applies the file only once.

History and notifications have separate migration files with a `007` prefix.
The runner tracks their complete filenames, so both are applied safely. Keep
`007_opportunity_history.sql` at its original name to preserve databases that
already applied US08 before the notification update.

The API automatically records:

- A submission, attributed to the staff member or hackathon submitter.
- A change from Submitted to Under Review when the first assessment is saved.
- An approval or rejection, including its saved reason and manager.
- Moving an approved opportunity to delivery, attributed to the manager.
- Changes to the linked project's delivery status, attributed to its updater.

Opportunity approval and project delivery are separate lifecycles. Delivery
events belong to the opportunity's history but do not change its approval
status. Repeated saves of the same status, progress/note-only updates and edits
to assessment scores without a status change do not create status events. This
is a status/decision history, not a full audit of every editable field.

The write queries use SQL common table expressions: named steps within one
statement. They lock the previous state, save the update and insert history
together. If history cannot be written, the entire statement rolls back,
including the decision or associated progress note. Concurrent decisions cannot
overwrite the accepted decision or add a second decision event. The actor comes
from the authenticated account; clients cannot set the history user or date.

### Reading the timeline

`GET /api/v1/opportunities/:id/history` requires a signed-in manager. It returns
401 without a session, 403 for staff/engineers and 404 for a missing or malformed
opportunity ID. The response is:

```json
{
  "opportunityId": "7f6c00a8-b782-4bd5-8d1a-5fdad6b2cb2e",
  "items": [
    {
      "id": "21",
      "eventType": "decision_recorded",
      "statusType": "opportunity",
      "fromStatus": "in_assessment",
      "toStatus": "rejected",
      "actor": { "id": "6bfcbbab-9947-417e-9b04-d76efa7cb9b9", "name": "Demo Manager" },
      "reason": "Already covered by another project.",
      "occurredAt": "2026-11-19T10:15:00.000Z",
      "source": "live"
    }
  ]
}
```

Entries are returned oldest first, ordered by event timestamp and then the
increasing history ID to resolve ties. IDs are strings to preserve bigint
precision. `statusType` is `opportunity` or `delivery`. A null `fromStatus` means
creation or an unknown previous state on a recovered decision; null `reason`
means no reason was recorded for an approval, or the event is not a decision.
An existing imported opportunity can have an empty `items` array.

There are no API routes for creating, editing or deleting history entries. A
database trigger also rejects direct row edits/deletions. The existing staff
deletion rule is preserved: deleting an opportunity without a delivery project
also deletes its history. This is not an archival record of deleted requests or
a tamper-proof audit log against database administrators.

### Existing data and frontend handoff

The migration recovers stored submissions and the latest saved decision, using
their existing user IDs, timestamps and reasons. They have `source: backfill`;
their user-name snapshot uses the name available at migration time. Earlier
assessment and delivery transitions were not stored, so they cannot be
reconstructed. The migration does not invent dates, transitions or actors. New
API events have `source: live`; later account-name changes do not rewrite them.
Direct administrative SQL imports/updates are outside the recording workflow.

The frontend should request this endpoint when a manager opens an opportunity,
then display each event, actor name, date and decision reason in the supplied
order. Use readable status labels, distinguish delivery events, and show a
message if `items` is empty. Display recovered events as earlier recorded data
without implying the timeline is complete. Refresh the history after a decision
or status change. No history editing controls should be provided. These commits
implement the three backend tasks; they do not add a frontend timeline.

### Verification

The US08 tests cover upgrading existing data, repeat migrations, database
read-only protection, deletion policy, automatic recording, actor snapshots,
rollback, concurrent requests, endpoint permissions, chronological ordering and
unsupported history-write requests. Run `npm test` with a local
`TEST_DATABASE_URL` as described above. Tests use isolated schemas and cascade
their own cleanup into the history table; application data is not reset.

## Opportunity notifications (US09 backend)

US09 extends the existing `notifications` table and endpoints rather than adding
a second notification system. Apply its three commits after updating to the
latest main used for the patches. Stop the API, then run from `backend/`:

```bash
npm run db:migrate
npm start
```

No new dependencies, passwords or environment settings are needed. Do not reset
the database or edit old migration files. Migration `015_notification_events.sql`
adds a nullable, unique link to the history event and an index for read/all
queries. Existing messages, recipients, dates and read states are preserved;
older messages keep a null event link because it cannot be inferred reliably.

Migration `016_notification_generation.sql` installs a database trigger: a
function PostgreSQL runs automatically when a live history entry is inserted.
US08 already writes history with each actual transition. The trigger creates
one notification for that event inside the same transaction. If notification
creation fails, the status change, decision, project changes and history all
roll back together. The former extra notification calls in route handlers have
been removed, including the automatic assessment path.

Messages go to the opportunity's submitter for Under Review, Approved, Rejected,
In Progress, Testing and Completed events. Approval creates one decision
notification even though it also starts a delivery project. Repeated saves of
the same status, progress/note/date-only changes, initial submission and
backfilled history do not create notifications. A later genuine transition back
to a previous stage gets its own event and notice. A person is not notified
about their own action. These are stored in-app messages, not emails, browser
push messages or a live subscription; the frontend fetches the current list.

### Notification endpoints

| Request | Result |
| --- | --- |
| `GET /api/v1/notifications` | Unread messages, keeping the existing bell compatible. |
| `GET /api/v1/notifications?status=unread` | Explicit unread view. |
| `GET /api/v1/notifications?status=read` | Previously read messages. |
| `GET /api/v1/notifications?status=all` | Both read and unread messages. |
| `POST /api/v1/notifications/:id/read` | Mark your notification read; returns 204 with no response body. |

All requests require the existing signed-in session. The POST also requires
the session's CSRF token, which the frontend API helper already sends. No
request body is required. The API derives the recipient from the session and
also checks that they own the linked opportunity. Query/body user IDs cannot
select another person's inbox. Another account's notification ID returns 404,
as do malformed and missing IDs. Invalid/repeated status filters return 400.

The GET response contains `items` and `unreadCount`. Each item has `id`,
`opportunityId`, `kind`, `message`, `createdAt`, `isRead` and `readAt`. Items are
newest first, ordered by creation timestamp and then descending ID for ties.
`unreadCount` always counts all unread messages for the current owner, even in
the read/all views. List and count come from one database snapshot. An empty
inbox returns `{ "items": [], "unreadCount": 0 }`.

GET never marks records read. The POST sets `readAt` on the server and keeps the
first timestamp if called again. It does not delete the notification: it remains
available through the read/all views after refreshing or restarting the API.
There is no public endpoint to create messages, choose recipients or reset
messages to unread. Existing opportunity deletion still cascades to its notices.

### Frontend integration and local checks

The existing bell already uses these paths and links messages to
`/opportunities/${opportunityId}`. Its default unread request is unchanged.
It currently marks displayed messages read when opened. This commit does not
redesign that component: a persistent read/all view and visible per-message
read indicators still need frontend integration to complete the full US09
interface criteria. The API supports them with the status filter, `isRead`,
`readAt` and `unreadCount`. Retain the existing ownership checks when opening
the opportunity. Refetch on menu opening or refresh to see new saved messages.

To verify locally:

1. As staff, submit an opportunity. As manager, assess it and record a decision.
   If approved, use the engineer view to update its project delivery status.
2. Sign back in as the submitting staff user and inspect the bell. Another staff
   account should receive none of these messages. Selecting the link should open
   the submitted opportunity.
3. On the frontend website, use the developer console to inspect all records:

   ```js
   fetch('/api/v1/notifications?status=all', { credentials: 'same-origin' })
     .then(async response => ({ status: response.status, body: await response.json() }))
     .then(console.log);
   ```

4. Compare `isRead` and `readAt` before and after opening the current bell. Repeat
   the request after refreshing; read records should still exist. Change the
   query to `status=read` or `status=unread` to check the separate views.

`test/notification-schema.test.js` checks upgrading existing data and event
links. `test/notification-generation.test.js` checks actual/repeated/concurrent
transitions, ownership, automatic assessment and rollback on notification
failure. `test/notification-api.test.js` checks authentication, filters, read
persistence, CSRF, ownership, safe link targets and legacy records. Run `npm test`
with the local `TEST_DATABASE_URL` described above.

## Files to share

Keep this README, `.env.example`, `.gitignore`, and `package-lock.json` in Git. Keep the actual `.env` on your computer. The demo users and password are for local testing.

## How authentication is organised

- `src/auth/configure.js` adds missing random settings to your private `.env`.
- `src/auth/passwords.js` hashes and verifies passwords with Argon2id.
- `src/auth/sessions.js` sets up PostgreSQL sessions, checks account activity and
  expiry, and verifies CSRF tokens so another website cannot submit a write
  using your browser session.
- `src/auth/routes.js` handles CSRF setup, login, current-user lookup and logout.
- `db/migrations/006_authentication.sql` adds password/account fields and the
  session table, and renames the four existing demo usernames.
- `src/db/setup.js` seeds the users and password hashes without replacing IDs.

Sessions expire after 30 minutes idle or eight hours total. Browser refresh and
backend restarts preserve a valid session while SESSION_SECRET stays the same.
Login rotates the session identifier and CSRF token. Disabled accounts and
password resets invalidate existing sessions. The API rereads the database role
on protected requests. Login allows up to 20 failed attempts per IP in 15 minutes;
this counter is held in the single API process and resets when it restarts.

Local development uses the Vite API proxy, so frontend requests and session
cookies use one browser origin. A future deployment needs HTTPS, NODE_ENV=production,
and its reverse-proxy/cookie settings checked for that hosting arrangement.

## Sign-in integration (SCRUM-77)

The existing sign-in screen now accepts email and password. It handles incorrect
credentials, failed connections and repeated submissions. On refresh, the app
asks `GET /auth/me` for the account instead of trusting browser storage. The
request helper sends cookies and CSRF tokens for opportunities, projects and
benefits, including deletion. Logout ends the database session. A server response
of 401 returns the user to sign-in; an unavailable service offers a retry.

To verify the integration, try a wrong password, then sign in with the correct
one, submit a request and refresh. Sign out and check it with the second Staff
account. Use the Manager and Engineer accounts to run the US03–US05 checks above.

## Backend permissions (SCRUM-76)

| Action | Staff | Manager | Engineer (`team`) |
| --- | --- | --- | --- |
| Ordinary submission | Yes | No | No |
| Own submissions and details | Yes | Yes | Yes |
| Other people's opportunities | No | All | Approved only |
| Hackathon submission | No | No | Yes, existing API support |
| Assessment and approve/reject | No | Yes | No |
| Create a delivery project | No | Yes | No |
| Read delivery projects and update progress | No | Yes | Yes |
| Read benefits | No | Yes | Yes |
| Add or edit benefits | No | Yes | No |

Engineer lists and details also retain access to their own hackathon submissions.
The visibility rule applies in SQL before list filtering and pagination. Staff
ownership and manager-only write rules are checked by the backend even if a
caller bypasses the website. Academic and non-academic staff share the Staff
permission role; this version does not verify university employment categories.
## Existing-solution catalogue (US10)

Run `npm run db:migrate` from `backend/` after updating. Migration 017 imports
the six prototype service examples as **unverified drafts**. They are not new
claims that those services or their features have been checked. A manager must
review the current service information/access route before explicitly verifying
an entry. Migration reruns preserve saved edits and verification states.

The API uses the existing session cookie and CSRF token:

| Endpoint | Access | Purpose |
| --- | --- | --- |
| `GET /api/v1/solutions?q=room&limit=20` | Signed-in users | Search active, verified, accessible records only. |
| `GET /api/v1/solutions/catalogue?state=draft` | Manager | Inspect drafts, verified entries or archived entries; `state=all` is the default. |
| `POST /api/v1/solutions/catalogue` | Manager + CSRF | Create a catalogue entry. |
| `PUT /api/v1/solutions/catalogue/:id` | Manager + CSRF | Replace the full editable record, verify/unverify it, or archive it with `active=false`. |

Editable fields are `name`, `description`, `keywords` (up to 20), `href`
(HTTPS only), `accessInstructions`, `visibility` (`all_users` or `manager_only`),
`active`, `verified`, and `verificationNotes`. A link or access instructions are
required. Setting `verified=true` requires an explanation of the verification;
the server records the manager ID and verification date. Editing content without
explicitly setting `verified=true` withdraws it until checked again. PUT resets
omitted optional fields to their defaults; it is not a partial update.

Staff and engineers cannot read manager-only catalogue entries or management
metadata. Search filtering takes place in PostgreSQL. No catalogue management
screen is included; use an authenticated API client for these endpoints.

### Chatbot integration: Gemini for private experiments

`POST /api/v1/solutions/check` accepts `{ "text": "Book a meeting room" }` and
optional `previousMessages`: up to eight `{ "role": "user" | "assistant",
"text": "..." }` records. Text/messages are limited to 800 characters each.
Responses contain `decision` (`match`, `none`, `clarify`, `help`, or `unavailable`),
`question`, `matches`, `message`, and `canSubmit: true`. Matches include the
current catalogue name, description, reason, HTTPS link or access instructions.
The browser no longer contains its own list of six services. Reviewed application
help answers submission/tracking and other usage questions without an AI call.
Submission help provides an Open opportunity form action. It does not retrieve
private records or change application data.

The checker searches accessible verified entries, supplies at most eight
candidates to Gemini and accepts at most three returned candidate IDs. Unknown
IDs are discarded. Links and access instructions come from PostgreSQL, never
from the model. Entries changed, archived, unverified or restricted during an
AI call are discarded before the reply. Search is bounded; a no-match response
is not a claim that no solution exists anywhere at LSBU.

**Agreed scope: private developer experiments, with Google billing disabled.**
Google's current terms require Paid Services when making an API client available
to UK users. This setup must not be described as a free deployment option for
an LSBU-facing website. This adapter returns unavailable in production mode.
See [ChatBot-setup.md](ChatBot-setup.md) and [Google's terms](https://ai.google.dev/gemini-api/terms).

Create a key in [Google AI Studio](https://aistudio.google.com/api-keys), using a
project that displays **Free tier** and has no linked billing account. Configure
only the private backend/.env:

```dotenv
GEMINI_API_KEY=your-own-private-key
GEMINI_MODEL=gemini-3.5-flash-lite
```

The default model is Gemini 3.5 Flash-Lite; Gemini 3.1 Flash-Lite is also allowed.
Both have a published free tier as checked on 26 November 2026. Other model
names are rejected before a request. **The application cannot determine whether
your Google project has billing enabled.** Model selection does not force free
billing if the key belongs to a paid project. Do not enable billing or upgrade
for these experiments. Eligibility, model availability and quota are controlled
by Google and must be checked in your own account.

Requests use Google's generateContent endpoint, a server-only x-goog-api-key
header, JSON Schema output, a 20-second timeout, minimal thinking and a
1,024-token output cap for catalogue checks and benefit suggestions; reviews
have a 4,096-token cap. No Google Search tools, other paid tools, fallback models
or automatic retries in the provider adapter are enabled. There is no fallback
to another provider. An exhausted Google quota returns a safe 503 response and staff can still submit an opportunity.
No new package or database migration is needed for this provider change.

All external AI features now use the shared `src/ai/gemini.js` adapter: catalogue
checks, benefit suggestions and opportunity benefit reviews. Their settings are
GEMINI_API_KEY and GEMINI_MODEL; retired OpenAI variables can be removed.
The private-only production guard applies to all three. Existing saved reviews
are retained. Manual submission and benefit recording remain available on AI
failure. See [ChatBot-setup.md](ChatBot-setup.md) for workflows, data sent to the
provider, catalogue management, application help and testing.

The route allows 20 checks per signed-in account per five minutes, using an
in-memory limiter for the single-process prototype. Multiple API replicas would
need a shared limiter store. This feature saves no conversation transcript.
Eligible catalogue descriptions/keywords and bounded chat context are sent to
Google; verification metadata, access links and API credentials are not part
of the prompt. Use synthetic coursework examples for these experiments and
review Google's data-use terms. No zero-retention guarantee is made.

On missing configuration or unsupported/production configuration (503), provider
error/refusal/invalid output/timeout (502), provider quota exhaustion (503), or
local route rate limiting (429), responses expose no provider details or keys
and retain canSubmit=true. The frontend keeps Submit anyway available. Ordinary
submission never requires a chatbot result. Restart cancels the browser request
and ignores late responses.

Run backend checks with npm test and TEST_DATABASE_URL set as described above.
From frontend/, run npm test and npm run build. Provider responses in automated
tests are simulated; no real Google key/quota/model response has been verified.
