# AI Foundry backend

This guide sets up a local database and runs the Sprint 1 API for submitting and tracking opportunities. Run the first-time steps once on each computer.

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
npm run db:migrate
npm run db:seed
npm start
```

The migration creates the `users` and `opportunities` tables. The seed command adds the demo users. You can repeat these two commands without duplicating the tables or the users. After `npm start`, keep that window open while you test.

## Check the Sprint 1 API

Keep the backend running and open another Terminal window. The commands below use Bash or Zsh. On Windows PowerShell, you can use the automated checks described below. The demo header tells the API which test user is making the request.

**US01 · Submit an Opportunity.** Paste this block to save a sample request:

```bash
curl -i http://127.0.0.1:3000/api/v1/opportunities \
  -H 'X-User-Email: staff@example.com' \
  -H 'Content-Type: application/json' \
  -d '{"title":"Sprint 1 test request","department":"Estates","problemDescription":"Room bookings are confirmed by hand.","proposedImprovement":"Send booking confirmations automatically."}'
```

Look for `201 Created`, a generated `id`, and a status of `submitted`.

**US02 · Track a Request.** Run the next command and look for the same ID under `items`.

```bash
curl -i -H 'X-User-Email: staff@example.com' http://127.0.0.1:3000/api/v1/me/opportunities
```

To open one saved request, replace `YOUR_ID` below with the ID from the submission response. The other demo staff user, `staff2@example.com`, receives `403` when trying to open that request.

```bash
curl -i -H 'X-User-Email: staff@example.com' http://127.0.0.1:3000/api/v1/opportunities/YOUR_ID
```

For the automated checks, run `npm test` from `backend/` while PostgreSQL is running. The example `.env` includes `TEST_DATABASE_URL`. The tests create and remove their own schema, separate from your demo requests.

## Run the website separately

From the project folder, open a new terminal window and run:

```bash
cd frontend
npm ci
npm run dev
```

Run `npm ci` the first time or after a dependency change. Open the **Local** address printed by Vite. The React website still uses sample data. Connecting the submission form and **My Opportunities** page to the API is the remaining integration work.

## Files to share

Keep this README, `.env.example`, `.gitignore`, and `package-lock.json` in Git. Keep the actual `.env` on your computer. The demo users and password are for local testing.
