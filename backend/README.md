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

Sign out and use the Manager account to assess requests. Account roles are assigned in the database; the role preview menu is removed by SCRUM-77.

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
