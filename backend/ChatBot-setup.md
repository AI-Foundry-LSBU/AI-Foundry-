# AI Foundry: Gemini, Alice and catalogue guide

Alice helps staff find existing solutions before submitting an opportunity, and
explains how to use AI Foundry. The same Gemini configuration now powers the
catalogue checker, benefit suggestions and opportunity benefit reviews.

This guide covers setup, maintaining any catalogue entry, application help, the
main opportunity/project workflows and testing. Full first-time database setup
is in [README.md](README.md); request schemas are in
[OpenAPI](../docs/api/openapi.yaml).

The backend already contains the chatbot's rules. The team supplies accurate catalogue
descriptions, keywords and access details. Draft, archived and restricted entries are
filtered before recommendations are returned. A no-match result means nothing suitable
was found in the checked entries; it does not prove that no solution exists elsewhere.

If your website is already running, try the application-help questions below,
or go to **Section 5** for catalogue management. For normal restarts use
**Section 4**. Setup and verification are not a daily checklist.

## What Alice can answer

| Type of question                                   | How it works                                                                  | Needs a verified catalogue entry?                  |
| -------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------- |
| "How do I submit or track an opportunity?"         | Reviewed application instructions from the backend; no Gemini call            | No                                                 |
| "I need a way to share teaching materials."        | Catalogue search and a Gemini check, with a reason and access route           | Yes                                                |
| "What is the status of my particular request?"     | Alice explains where to look; open the actual request to see its saved status | Alice does not look up private records in the chat |
| Unrelated general knowledge or university policies | Outside this assistant's defined scope                                        | Use the appropriate service or source              |

Application help covers submission, tracking, statuses, notifications, manager
assessment/decisions, delivery projects, benefits, history, catalogue management
and sign-in. Answers depend on the signed-in role. These are instructions, not
commands: Alice cannot approve a request, save benefits, change roles, disclose
credentials or submit a form for you.

For submission help, Alice shows **Open opportunity form**. Clicking it opens
the real form. The top-bar **Submit anyway** button remains available throughout.
Application help works without a Google key or verified catalogue; actual
solution recommendations still require both. Login and CSRF protection remain
in force for help requests too.

Try these questions in Alice:

- "How can you help me?"
- "What is an opportunity?"
- "Help me to submit an opportunity."
- "How do I track my request?"
- "What do opportunity statuses mean?"
- "How do notifications work?"
- "How do I assess an opportunity?"
- "How do I update project progress?"
- "How do I record benefits?"
- "Where can I view opportunity history?"
- "How do I manage the catalogue?"

## Using the main application workflows

These steps describe the current screens. Alice can explain them, but you
perform the actions in the website. Your account role controls access.

| Workflow                      | Where and what to do                                                                                                                                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staff submission              | Open Submit Opportunity, check solutions with Alice or select Submit anyway. Complete the title, department, problem and proposed improvement. Submit, then keep the confirmation reference. The request is saved with its date and initial Submitted status. |
| Staff tracking                | Open My Opportunities and select your request. Refresh to load saved updates. You can only access your own requests.                                                                                                                                          |
| Manager search and assessment | Open All Opportunities. Search/filter, select a request and review the five criteria, category and priority. Use Save Assessment for your reviewed changes.                                                                                                   |
| Manager decision              | On the opportunity, use the decision controls and Save Decision. A rejection requires a reason. The decision and status are saved.                                                                                                                            |
| Delivery setup                | A manager opens an approved opportunity and selects Move to Project Delivery. This creates a separate project linked to that opportunity.                                                                                                                     |
| Engineer/manager progress     | Open Project Delivery and select a project. Use the permitted status/note controls and Save Progress. Available controls depend on role, assignment and stage. Refresh to confirm the saved change.                                                           |
| Recording benefits            | A manager opens Benefits Reporting > Record Benefit, selects a delivery project and enters the measure, estimated and actual values, unit, date and other required fields. Use Save Benefit; Edit and Update Benefit change an existing record.               |
| Comparing benefits            | Use Benefits Reporting. Compare estimated and actual values in the same unit. Hours, money, cases, percentages and durations are not one combined grand total. AI estimates are not measured actual results.                                                  |
| Opportunity history           | A manager opens the opportunity's activity history to read changes, dates, users and decision reasons. Previous entries are read-only. The separate History navigation page lists completed projects.                                                         |
| Notifications                 | Use the bell, open the linked opportunity and use Dismiss to mark the notification read. Notification/read state is saved. These are in-app notifications, not emails.                                                                                        |

Opportunity review status and project delivery status are separate. A request
can be approved before work starts. Project statuses are Not Started, In
Progress, Testing and Completed. Completed projects appear in History.

### AI suggestions and reviews

The following calls all use `backend/src/ai/gemini.js` and the same
`GEMINI_API_KEY` / `GEMINI_MODEL`:

- **Catalogue checker:** asks for a suitable verified solution or a clarification.
- **Benefit suggestion:** the manager-only benefit-suggestion endpoint returns a
  draft measure. It does not save a benefit; review it before recording one.
- **Opportunity benefit review:** the existing backend can generate and save an
  AI review when an opportunity is submitted or opened. When a manager opens an
  unassessed Submitted request, its initial AI assessment can also be saved,
  moving it to Under Review. The manager should check/edit the assessment.
  Approval/rejection remains a separate manager action.

Having a Gemini key now enables those existing benefit AI features as well as
the catalogue checker. Expect them to consume quota too. Changing provider does
not delete saved records or automatically regenerate every previously saved
review. AI-generated recommendations and scores need human checking. Normal
submission and manual benefit recording remain available if AI is unavailable.

For private experiments, use synthetic data. The benefit suggestion sends the
selected opportunity text. The review also receives supplied context such as
existing opportunity titles and benefit descriptions. The catalogue checker
sends eligible candidate names/descriptions/keywords and bounded chat context;
access links and private catalogue verification metadata are excluded. Application
help sends no data to Google. Keep sensitive real records out of these experiments.

## 1. Before starting

Use a checkout containing the US10 changes. For a first-time project setup,
follow [the backend README](README.md) first. It covers Node.js, PostgreSQL,
database URLs, application accounts and passwords. This guide assumes that
normal sign-in and opportunity submission already work.

After pulling code, stop the backend with **Ctrl+C**. From the repository root:

```bash
cd backend
npm ci
npm run db:migrate
```

Run `npm ci` on a new checkout or when dependencies change. Migrations can be
repeated: only files that have not already run are applied. The catalogue
migration imports six **unverified drafts**, not six approved recommendations.
The two `017_...sql` files have different full filenames, which the runner tracks
separately. Keep both; do not rename already-applied migrations.

Do not recreate the database or repeat first-time account setup every day.

## 2. Get a Gemini key for private experiments

1. Open [Google AI Studio API keys](https://aistudio.google.com/api-keys) and sign
   in with your own Google account. Accept the terms if prompted.
2. Create or select a project showing **Free tier** on the
   [Projects page](https://aistudio.google.com/projects), without a linked active
   billing account.
3. Create a key in that project. Copy it into your private `backend/.env`.
4. Keep billing disabled. Do not add payment details or upgrade to resolve a
   quota error. If your account is not eligible for the free tier, stop here.

Google controls availability, pricing and quota. The application cannot check
your billing tier. A model with a free tier can still incur charges on a paid
project. Do not share keys in GitHub, Teams, screenshots or this guide.

## 3. Configure backend/.env

Keep the existing database URLs, session secret and application passwords.
Add or update these lines in **your private `backend/.env`**:

```dotenv
GEMINI_API_KEY=paste_your_own_Gemini_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
```

Replace the key placeholder with your own key. The model name is not a secret.
The other supported model is `gemini-3.1-flash-lite`; other names are rejected.
Both have a published free tier as checked on 26 November 2026. Account eligibility
and availability still need checking in AI Studio.

All external AI features now use Gemini. No OpenAI key is needed. You can remove
old `OPENAI_API_KEY` and `OPENAI_MODEL` lines from your private `.env`; the
application no longer reads them. Existing manual workflows and saved records
remain available. Switching providers in future requires a code change, not
just a different key in `.env`.

Commit only placeholders in `.env.example`. Never commit `.env` or a real key.
Restart the backend after changing `.env`.

## 4. Start the local website

Make sure PostgreSQL is running. In the first Terminal, from the repository root:

```bash
cd backend
npm start
```

Wait for `AI Foundry API listening at http://127.0.0.1:3000/api/v1`.

In a second Terminal, from the repository root:

```bash
cd frontend
npm ci
npm run dev
```

Run the frontend `npm ci` on first setup or after a dependency change. Open the
**Local** address printed by Vite. Keep both Terminals open. Normally Vite
forwards `/api` requests to the backend on port 3000.

| Application account   | Use                                               |
| --------------------- | ------------------------------------------------- |
| `manager@lsbu.ac.uk`  | Manage the catalogue                              |
| `staff@lsbu.ac.uk`    | Test the staff chatbot and opportunity form       |
| `staff2@lsbu.ac.uk`   | Test a second staff account                       |
| `engineer@lsbu.ac.uk` | Test engineer access; cannot manage the catalogue |

These are coursework application accounts. Use the passwords in your own
private `.env`, such as `DEMO_MANAGER_PASSWORD`, rather than university passwords.

## 5. Maintain the catalogue without a manager screen

This is a manager setup/maintenance task, not something every staff user does.
Check each entry before approving it. Do not approve all drafts merely to make
the chatbot respond.

For a first test, use **List the entries**, check one entry, then use **Verify
one checked entry** and go to Section 6. Adding, editing and archiving are
separate maintenance examples, not steps you must all run in order.

### Check the content first

The researcher should provide the solution's name, accurate capabilities, useful
keywords, link or access instructions, intended audience and the source used to
check it. Confirm that the access route works. Do not put passwords, confidential
information or unconfirmed claims in catalogue descriptions.

Verification notes should say what was checked and cite the service owner or
documentation. They are different from the backend instructions sent to Gemini.

### Open the Console on your local website

Sign in as **manager@lsbu.ac.uk**. Open the browser developer tools and select
**Console**. Run these commands there, not in Terminal or on a Google page.
On Safari, enable developer features in Settings > Advanced if the Develop menu
is unavailable, then open the JavaScript Console from Develop.

Paste the complete helper block once. It uses your signed-in session and obtains
the CSRF token needed for writes. It does not contain an AI key or print your
session token. Some Consoles reject `await` on its own, so the examples use
functions and `.then(...)`.

```javascript
window.catalogueApi = async function (path = "", method = "GET", body) {
  if (body && JSON.stringify(body).includes("REPLACE")) {
    throw new Error(
      "Replace the sample text with checked information before saving.",
    );
  }
  const authResponse = await fetch("/api/v1/auth/me");
  if (!authResponse.ok) throw new Error("Sign in as the manager first.");
  const account = await authResponse.json();
  if (account.user.role !== "manager")
    throw new Error("A manager account is required.");

  const response = await fetch("/api/v1/solutions/catalogue" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(method === "GET" ? {} : { "X-CSRF-Token": account.csrfToken }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error("HTTP " + response.status + ": " + JSON.stringify(result));
  return result;
};

window.changeSolution = async function (name, changes) {
  const result = await window.catalogueApi(
    "?state=all&limit=50&q=" + encodeURIComponent(name),
  );
  const matches = result.items.filter((entry) => entry.name === name);
  if (matches.length !== 1)
    throw new Error("Use the exact name of one unique entry.");
  const entry = matches[0];
  const editable = Object.fromEntries(
    [
      "name",
      "description",
      "keywords",
      "href",
      "accessInstructions",
      "visibility",
      "active",
      "verified",
      "verificationNotes",
    ].map((key) => [key, entry[key]]),
  );
  return window.catalogueApi("/" + entry.id, "PUT", {
    ...editable,
    ...changes,
  });
};
```

Paste the helper again after refreshing/closing the page. Saved entries stay
in PostgreSQL; the helper is just a Console shortcut. `changeSolution` preserves
other editable fields because PUT expects a complete entry. If names are
duplicated, stop and use an API client with the intended record's ID.

### List the entries

```javascript
catalogueApi("?state=all&limit=50")
  .then((result) => {
    console.log("Total matches:", result.total);
    console.table(
      result.items.map((entry) => ({
        name: entry.name,
        description: entry.description,
        href: entry.href,
        accessInstructions: entry.accessInstructions,
        active: entry.active,
        verified: entry.verified,
        visibility: entry.visibility,
      })),
    );
  })
  .catch(console.error);
```

Use `state=draft`, `state=verified` or `state=archived` to narrow the list.
At most 50 entries are returned per request. If there are more matches, add `q=`
with a specific name or search term. A draft is active but unverified; an
archived entry has `active: false`.

### Choose the entry to maintain

For an existing entry, copy its exact name from the list and set it once:

```javascript
window.solutionName = "REPLACE with the exact catalogue entry name";
```

For example, use `window.solutionName = 'Moodle'` only when Moodle is the entry
you want to change. Any uniquely named catalogue entry can be selected this way.
The following edit, verify and archive examples use `solutionName`.

### Add a new solution as a draft

Replace the sample text before running this. Supply a real HTTPS link in `href`
or useful access instructions. Use it for a new service, rather than duplicating
an imported entry such as Moodle.

```javascript
catalogueApi("", "POST", {
  name: "REPLACE with the solution name",
  description: "REPLACE with its confirmed capabilities and intended use.",
  keywords: ["REPLACE with a relevant keyword"],
  href: null,
  accessInstructions: "REPLACE with the confirmed access instructions.",
  visibility: "all_users",
  active: true,
  verified: false,
  verificationNotes: null,
})
  .then(console.log)
  .catch(console.error);
```

A successful creation returns the saved entry. Drafts cannot be recommended.

### Edit an existing entry

Choose the entry as shown above and edit the description before running.
Return changed content to draft until it is checked.

```javascript
changeSolution(solutionName, {
  description: "REPLACE with the reviewed description.",
  verified: false,
  verificationNotes: null,
})
  .then(console.log)
  .catch(console.error);
```

You can change keywords, `href`, access instructions or visibility in the same
way. Use `all_users` for all signed-in application roles or `manager_only` for
manager-only entries. Do not classify restricted information as `all_users`.

### Verify one checked entry

After reviewing its actual content and access route, replace the note below
with the real source and capabilities checked. Do not run with the placeholder.

```javascript
changeSolution(solutionName, {
  verified: true,
  verificationNotes: "REPLACE with the source/link and what you checked.",
})
  .then(console.log)
  .catch(console.error);
```

Check that the result has `verified: true`, `active: true` and the correct
visibility. The server records the manager and date automatically. This is
application approval, not an approval request to Google or LSBU IT.

### Archive an entry

After choosing the correct entry, this removes it from recommendations while
keeping the database record:

```javascript
changeSolution(solutionName, { active: false })
  .then(console.log)
  .catch(console.error);
```

To restore it for review, use `{ active: true, verified: false, verificationNotes: null }`.
It will need verification again before being recommended.

## 6. Test it as staff

First test application help: sign in as staff, open Submit Opportunity and ask
"Help me to submit an opportunity". Use **Open opportunity form**, then return
to Alice and ask how to track your request. These answers should work even when
the key is missing or no entries are verified.

Then test catalogue recommendations:

1. Verify at least one suitable `all_users` entry using the manager account.
2. Sign out and sign in as `staff@lsbu.ac.uk`.
3. Open **Submit Opportunity**. Alice should appear before the form.
4. Describe a problem covered by the entry. For Moodle, try: "I need somewhere
   to share module materials and assignments with students."
5. Answer any follow-up. A recommendation should have a relevant reason and the
   catalogue's link or access instructions. AI responses can vary.
6. Select **Submit anyway**, complete the form and submit. Refresh **My
   Opportunities** and check that the saved request is still there.
7. Try an unrelated problem: a no-match or follow-up should still let you proceed.
8. Test fallback in your private local setup: stop the backend, temporarily empty
   `GEMINI_API_KEY`, restart it and send a message with a verified entry available.
   **Submit anyway** must still work. Restore the key and restart afterward.
9. Restart the chat while a request is pending. Its late response should not
   appear in the restarted conversation.

Use synthetic coursework examples. The bounded conversation and eligible
candidate names, descriptions and keywords are sent to Google. Access links
and private verification metadata are excluded from that prompt. Links in
recommendations come from our database, not the AI.

### What is saved?

- Catalogue entries and verification are saved in PostgreSQL. Restarting the app
  does not remove them; verification does not need repeating on every launch.
- Submitted opportunities are saved in PostgreSQL.
- Chat messages are held in page state, not saved as a transcript by the app.
  Refreshing/restarting the chat clears them. Provider handling follows Google's terms.
- Each teammate's local database is separate. Git transfers code and migrations,
  not entries or verifications changed on your laptop. A new database starts
  with drafts. Coordinate checked content through SCRUM-143; each local manager
  enters/verifies it in their own database. Do not share `.env`.

## 7. If something fails

The chatbot currently shows the same general message for several failures. It
does not reveal the exact provider error. A failed check does not delete the
catalogue and must not prevent submission.

Open developer tools > **Network**, reproduce the error once, then select the
request ending in `solutions/check`. Note its HTTP status and **Response** JSON.
Share those with the developer, the test message and approximate time. Do not
share headers, cookies, tokens, keys or the complete `.env`.

| HTTP status               | What to check                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 200 with `decision: help` | Reviewed application instructions. No Gemini call or catalogue match is needed.                                                                         |
| 200 with `decision: none` | Nothing suitable in the checked set. Confirm entries are verified, active and visible. This is not an AI-service error.                                 |
| 400                       | Inspect the returned `fields`; input failed validation.                                                                                                 |
| 401                       | Sign in again; the session may have expired.                                                                                                            |
| 403                       | Check account role and, for writes, the CSRF token. Management needs a manager.                                                                         |
| 404                       | Check that the backend has the US10 routes and that the URL/record ID is correct.                                                                       |
| 429                       | The app allows 20 checks per account per five minutes per API process. Wait or submit anyway.                                                           |
| 502                       | Provider failure, timeout, blocked reply or invalid response. The browser response does not distinguish these causes.                                   |
| 503                       | Check the Gemini key, supported model, production guard and Google quota. A Google 429 becomes a safe 503 response. Do not enable billing to bypass it. |
| No HTTP response          | Check both servers and PostgreSQL, and that Vite targets the correct backend.                                                                           |

The shared provider adapter has a 20-second timeout and makes one attempt per
call, with no paid-model switch or other provider fallback. Output caps are
1,024 tokens for catalogue checks and benefit suggestions, and 4,096 for reviews.
A screenshot saying "could not be checked" is not enough to diagnose quota
failure. The original intermittent provider failure has not been diagnosed from
a live response. Submission-help questions are now answered locally and no longer
depend on a provider call.

## 8. Automated checks

With PostgreSQL running and `TEST_DATABASE_URL` set in your private `.env`, run
from the repository root:

```bash
npm --prefix backend test
npm --prefix frontend test
npm --prefix frontend run build
```

Tests use isolated schemas and synthetic fixtures, with simulated provider
responses. They do not call Gemini or use your real key. The integrated
Gemini/application-help version passed 111 backend tests, three frontend tests
and a frontend build in the development workspace. Browser checks covered
application help, opening the real form, recommendations, fallback and saving
an opportunity. Provider responses were simulated in those checks. This does
not verify every teammate's Google account, quota or live response quality. Record manual
acceptance results separately.

## 9. API hand-off for the frontend

The contract is in [docs/api/openapi.yaml](../docs/api/openapi.yaml). All paths
below start with `/api/v1`. Use the existing session and API helper; do not use
`X-User-Email`. Writes require `X-CSRF-Token`.

| Method and path                                     | Purpose                                                      | Access                                         |
| --------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------- |
| `GET /solutions?q=...&limit=20`                     | Search active, verified, accessible entries                  | Signed-in staff, managers and engineers        |
| `GET /solutions/catalogue?state=all&limit=50&q=...` | Search management records, including drafts/archived entries | Manager only                                   |
| `POST /solutions/catalogue`                         | Create a draft or checked entry                              | Manager only + CSRF                            |
| `PUT /solutions/catalogue/{id}`                     | Replace editable fields; also verify/archive                 | Manager only + CSRF                            |
| `POST /solutions/check`                             | Check candidates against a problem/conversation              | Signed-in staff, managers and engineers + CSRF |

Catalogue write fields are `name`, `description`, `keywords`, `href`,
`accessInstructions`, `visibility`, `active`, `verified` and `verificationNotes`.
Name and description are required. Supply an HTTPS link or access instructions.
A verified entry requires verification notes. Do not send IDs, timestamps or
verifier metadata in a write body. PUT is a complete replacement, not a partial
update: preserve other editable fields. Omitting `verified` defaults it to
false. The optional manager screen can use these endpoints without a new API.

The checker accepts `{ text, previousMessages }`: text is 1–800 characters and
previousMessages is optional, with up to eight `{ role, text }` entries. Roles
are `user` or `assistant`; each message is 1–800 characters. Success responses
use `match`, `none`, `clarify` or `help`, with `question`, `matches`, `message`
and `canSubmit: true`. Help responses include `helpTopic`; `submit` lets the
frontend display the Open opportunity form button. Service failures use `decision: unavailable` and retain
`canSubmit: true`. Keep a visible route to the form when the request fails.

## 10. Adding more knowledge or help

For another existing solution, use Section 5 to add its description, keywords
and access route, then verify it after checking the source. This works for any
appropriate catalogue service, not only Moodle. Saved catalogue updates are
available to subsequent searches; no retraining or server restart is required.
The researcher supplies the content and the manager publishes it. A shared
research document is not automatically imported into the database.

For another application-help question, the developer updates the reviewed
answers and recognised wording in [src/solutions/help.js](src/solutions/help.js),
adds/updates the help tests and aligns this guide with the real screens. Do not
add unimplemented features or institution-wide policies as if they were verified
application instructions. More varied free-form help would be a separate change
requiring its own grounding and tests.

This does not add a manager catalogue screen. Its optional frontend task can use
the existing API. The current document explains the Console alternative.

## References

Google documentation checked on 26 November 2026:

- [API keys](https://ai.google.dev/gemini-api/docs/api-key)
- [Billing and tiers](https://ai.google.dev/gemini-api/docs/billing)
- [Gemini 3.5 Flash-Lite pricing](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)
- [Gemini API terms and data use](https://ai.google.dev/gemini-api/terms)
