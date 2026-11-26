# US10: existing-solution chatbot

**Provider update:** the follow-up `us10-03-gemini-free-tier.patch` changes the
checker to Gemini for private developer experiments with billing disabled.
Apply the two original patches once, then the follow-up. See
`US10-Gemini-private-setup.md` before configuring an API key. This is not a free
shared-site deployment configuration for UK users.

## What already existed

Lucila's latest `main` already included Alice before the submission form and an
OpenAI `gpt-4o-mini` call on the backend. Six service descriptions were hard-coded
in the backend and browser. This work keeps Alice and the existing API provider,
but makes PostgreSQL the source of catalogue records. It adds conversation context,
specific follow-up questions, verified recommendations and explicit Submit anyway
buttons. A catalogue management screen is not included in these two API tasks.

## The two commits

1. **US10 Add verified solution catalogue and protected management API**
   - Migration 017 adds the table and six unverified draft examples.
   - Search shows only active, verified records the signed-in user may see.
   - Manager-only create/update/list endpoints validate input and require the
     existing session and CSRF protection. The server stamps verifier IDs/dates.
2. **US10 Connect pre-submission chatbot to verified catalogue results**
   - The checker receives up to eight eligible database candidates
     and the previous conversation. It selects up to three candidate IDs or asks
     one specific follow-up question.
   - Server validation rejects unknown IDs. Links and access instructions come
     from current database records. In-flight catalogue changes are checked again.
   - Alice consumes the server cards, supports new catalogue entries without a
     frontend change, and always offers Submit anyway.
   - Tests, OpenAPI and backend setup notes describe both tasks.
3. **US10 Use Gemini free tier for private developer experiments** (follow-up)
   - Replaces the checker provider with Gemini. This does not rewrite or reapply
     either original commit. See the separate private setup guide for the key,
     free project status, production guard and UK use conditions.

## Apply the downloaded patches on your Mac

These patches were prepared against `main` at `734ebd4`. They are Git email
patches: **git am creates the commits for you**. Do not run git apply or make a
second manual commit for the same changes. Apply each patch once, in order.

First:

```bash
cd ~/Documents/AI-Foundry-
git status
```

Continue only when the working tree is clean. If it is not, preserve your changes
and ask for help before proceeding. Then:

```bash
git switch feature/backend &&
git config user.name "Polina Kaida" &&
git config user.email "127806886+polinakaida@users.noreply.github.com" &&
git fetch origin &&
git merge --ff-only origin/feature/backend &&
git merge --ff-only origin/main &&
git am "$HOME/Downloads/us10-01-solution-catalogue.patch" &&
git am "$HOME/Downloads/us10-02-catalogue-chatbot.patch"
```

If a command fails, stop and share its output. Do not force-push, reset or apply
the patches a second time to fix the error. These commands use your existing
`feature/backend`; they do not create another working branch. The two git config
commands set your name and verified GitHub no-reply email for this repository
only, including the committer identity used by git am.

Check the result:

```bash
git log -2 --oneline
git status
```

## Update your database and run the website

Stop the running backend with Ctrl+C. From the repository root:

```bash
cd backend
npm run db:migrate
npm start
```

Use a second Terminal window for the frontend:

```bash
cd ~/Documents/AI-Foundry-/frontend
npm run dev
```

Open the local address printed by Vite. Your existing database, users and
passwords stay in place. Do not recreate the database or rerun auth:configure.
There are no new runtime packages; `npm ci` is only needed if dependencies have
not been installed or the local installation needs restoring.

## API key and first catalogue entries

Apply the Gemini follow-up and read `US10-Gemini-private-setup.md` before setting
up the key. For the agreed private developer experiments, use a Google AI Studio
Free-tier project without linked billing, with these private backend/.env lines:

```dotenv
GEMINI_API_KEY=your-own-Gemini-key
GEMINI_MODEL=gemini-3.5-flash-lite
```

The application cannot verify your Google billing tier. The free-tier checker
is disabled in production and is not a free shared-site recommendation for UK
users. Keep OPENAI_API_KEY empty in a no-paid-API setup; older optional benefit
AI helpers still use it, while manual benefit recording remains available.

Never commit a real key, put it in frontend code or share your private .env.
Restart the backend after changing .env.

The migration's six examples are drafts. A manager must verify the current
content/access route before recommendations become available. Until then the
chat returns no match without calling an AI provider, and submission works.

## Manage and verify a record without a new admin screen

Use an authenticated API client, or sign in as `manager@lsbu.ac.uk` in the website
and open the browser's developer console. Run these read-only requests first:

```javascript
const account = await fetch('/api/v1/auth/me').then(r => r.json());
const catalogue = await fetch('/api/v1/solutions/catalogue?state=draft&limit=50').then(r => r.json());
console.table(catalogue.items.map(({ id, name, verified, href }) => ({ id, name, verified, href })));
```

Check the selected solution with its current service documentation or owner.
Replace its description if necessary so it states only verified capabilities.
For example, after checking Moodle, use the following template. **Replace the
verification note with what you actually checked. Do not bulk-verify the examples.**

```javascript
const entry = catalogue.items.find(item => item.name === 'Moodle');
const edited = {
  name: entry.name,
  description: entry.description,
  keywords: entry.keywords,
  href: entry.href,
  accessInstructions: entry.accessInstructions,
  visibility: entry.visibility,
  active: true,
  verified: true,
  verificationNotes: 'REPLACE with the service source and capabilities you checked.'
};
const saved = await fetch(`/api/v1/solutions/catalogue/${entry.id}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': account.csrfToken },
  body: JSON.stringify(edited)
});
console.log(saved.status, await saved.json());
```

A successful update returns 200. Only a signed-in manager may do this. PUT takes
all editable fields; omitting `verified` makes the entry a draft again. Set
`active: false` to archive it. A manager-only entry is never recommended to staff
or engineers. Verification notes and verifier IDs are not in public search/chat
responses. Catalogue management UI can be a separate frontend task later.

## Try it as staff

1. Verify at least one suitable catalogue entry using the manager account.
2. Sign out and sign in as `staff@lsbu.ac.uk` with your locally configured password.
3. Open Submit Opportunity. Alice should appear before the form. You may choose
   Submit anyway immediately.
4. Describe a vague problem, answer Alice's specific follow-up, and check that any
   recommendation has a reason and the database link or access instructions.
5. Choose Submit anyway after a recommendation. Complete and submit the form.
6. To exercise the configuration fallback locally, temporarily leave
   GEMINI_API_KEY empty and restart the backend. With a verified catalogue record
   available, the check should show that it cannot run; Submit anyway still opens
   the form. Restore your private key afterward. No-match also permits submission.
7. Restart the chat while a request is pending; a late reply should not appear in
   the new conversation. Check a narrow browser window as well.

A real AI response is not deterministic. A vague query does not guarantee that
it will choose clarification, and a related topic is not necessarily a suitable
match. A no-match means no suitable result in the bounded candidate set, not
proof that no solution exists anywhere at the university.

## Checks completed in the development workspace

- **103 backend tests passed** on an isolated PostgreSQL 18.6 database, including
  the previous workflows and all US10 catalogue/check tests.
- **2 frontend tests passed** for dynamic cards and response handling.
- **Frontend production build passed.**
- **OpenAPI 3.0.3 specification validation passed.**
- **Browser checks passed** for sign-in, chat before form, specific follow-up,
  database cards/links, restricted entries hidden, submit anyway saved to
  PostgreSQL, provider failure/no-match fallbacks, cancelled/stale responses,
  and a 390-pixel viewport without horizontal overflow or browser page errors.
- AI/provider responses in tests and browser checks were simulated. **A live
  Gemini call, your own API credentials/quota and your Mac have not been tested.**
- The six example services were not independently verified by this implementation.
  Managers must approve their content before they become recommendations.

To run the repeatable checks locally, use the existing TEST_DATABASE_URL in your
private backend/.env. Tests use isolated schemas and remove them afterward:

```bash
cd ~/Documents/AI-Foundry-/backend
npm test
```

```bash
cd ~/Documents/AI-Foundry-/frontend
npm test
npm run build
```

No university sign-in integration, email notifications, embedding database or
public chatbot endpoint is added. The API key remains on the server. The rate
limiter is in-memory for the current single-process prototype; multiple backend
instances would need a shared limiter store. This feature does not persist a
conversation transcript. Authorised candidate descriptions and bounded chat
context are sent to Google. Provider retention follows Google's terms; no zero-retention guarantee is made.

## Push and open the pull request

After applying, migrating and checking the website:

```bash
cd ~/Documents/AI-Foundry-
git log -2 --oneline
git status
git push origin feature/backend
```

Create a PR from feature/backend into main.

**PR title:** Add US10 verified solution catalogue and chatbot integration

**PR description:**

> Added PostgreSQL catalogue storage and manager-only catalogue management, with
> verification, visibility and input-validation checks. Connected the existing
> Alice/Gemini integration for private experiments to accessible verified catalogue results and bounded
> conversation context. Recommendations use current database links and access
> instructions. Staff can submit anyway after a recommendation, no match or AI
> failure. Updated OpenAPI and setup notes.
>
> Validation: 103 backend tests, 2 frontend tests, frontend production build,
> OpenAPI validation and browser checks passed. Provider responses were simulated;
> a real Gemini key/quota still needs checking locally. Imported catalogue examples
> are drafts until a manager verifies them. Catalogue management UI is separate.
