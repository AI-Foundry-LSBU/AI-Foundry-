# US10: Gemini for private developer experiments

This is a follow-up to the two US10 patches. It replaces the chatbot's OpenAI
call with Google's Gemini API. The catalogue, authorisation, frontend and
Submit anyway behaviour remain in place.

**Scope agreed with Polina: private Gemini experiments only; keep billing disabled.**
This is not a free deployment recommendation for the shared LSBU website.
Google's terms require Paid Services when making an API client available to
users in the UK. Do not enable billing to resolve a free-tier error. Pause and
review the provider choice before making this integration available to other
users or deploying it. The adapter does not contact Gemini in production mode.

## 1. Apply the follow-up patch once

Download `us10-03-gemini-free-tier.patch` into Downloads. The two earlier US10
patches must already be applied. Do not reapply them. First check:

```bash
cd ~/Documents/AI-Foundry-
git status
```

If the working tree is clean and no Git operation is in progress:

```bash
git switch feature/backend &&
git config user.name "Polina Kaida" &&
git config user.email "127806886+polinakaida@users.noreply.github.com" &&
git am "$HOME/Downloads/us10-03-gemini-free-tier.patch"
```

This creates one additional commit on your existing branch. It does not create
another branch or rewrite the two earlier commits. If it fails, stop and share
the output. Do not force-push or apply it again. Your private .env is not edited
by this patch.

If the earlier two patches have not been applied, follow their application
instructions first, then apply this third patch. There are no new packages or
migrations in the Gemini follow-up. The original catalogue migration 017 still
needs to have been run once using npm run db:migrate.

## 2. Get a Gemini key for private experiments

1. Open https://aistudio.google.com/api-keys and sign in with your own Google
   account. New users may be asked to accept the terms and create/select a project.
2. Select or create a project that shows **Free tier**. Check its status at
   https://aistudio.google.com/projects. Do not use a project linked to an active
   billing account. If your account cannot access the free tier, do not upgrade
   or add payment details for this coursework experiment.
3. Create an API key in that project. Copy it into your private backend/.env,
   not into a frontend file, screenshot, GitHub comment or chat message.
4. Keep billing disabled. Do not select Set up billing, add a card, prepay,
   enable auto-reload or upgrade to a paid tier. The application cannot inspect
   your Google project's billing state; this must be checked in AI Studio.

Free-tier availability and quota are set by Google and may differ by account.
The code does not create a Google project, enable billing, or make purchases.
A project marked Paid can incur charges even for a model that also has a free
quota on Free-tier projects. No application setting can force Google to treat
a paid-project API key as free.

## 3. Configure backend/.env

Keep all existing database, session and demo-password lines. Add/update:

```dotenv
GEMINI_API_KEY=paste_your_own_Gemini_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
```

Replace the placeholder with the actual Gemini key. The model line is a model
name, not a secret. Google currently lists Gemini 3.5 Flash-Lite with free text
input/output on the Free tier. Gemini 3.1 Flash-Lite is the other allowed model
if your private account has access. Other model names fail safely instead of
silently selecting a potentially paid model. These checks cannot certify your
Google billing tier or future pricing.

The US10 checker ignores OPENAI_API_KEY and OPENAI_MODEL. Earlier optional
benefit AI features in this repository still use OpenAI. For a no-paid-API
local setup, leave their key empty:

```dotenv
OPENAI_API_KEY=
```

This does not remove manual benefit recording. This change is limited to US10;
it does not convert all of the repository's older AI helpers to Gemini.

## 4. Restart and try the private prototype

Stop the backend with Ctrl+C, then run:

```bash
cd ~/Documents/AI-Foundry-/backend
npm start
```

Keep the usual frontend running in another Terminal window:

```bash
cd ~/Documents/AI-Foundry-/frontend
npm run dev
```

Use your local website for your own development experiments. Do not set
NODE_ENV=production for this adapter; Gemini requests are intentionally disabled
in production mode. Do not expose this experiment as the shared LSBU application.

A manager must verify at least one catalogue record before the chatbot attempts
an AI call. The six imported examples are drafts. Refer to
US10-setup-and-handoff.md for the manager API verification steps. With no verified
accessible records, the chatbot returns no match without contacting Google.

When records are available, ask a vague workflow question, answer any specific
follow-up, and check the suggested catalogue card. A suggestion is not a barrier:
Submit anyway must still open the opportunity form.

If the key/model is unavailable or the free quota is exhausted, the API returns
a safe unavailable response and you can submit anyway. It makes no automatic
retry, paid-model switch, OpenAI fallback, web-search tool call or purchase.
Check AI Studio's quota/status, or wait for its indicated reset. Do not enable
billing to make the experiment continue.

Only eligible catalogue descriptions/keywords and the bounded conversation are
sent to Google. Private verification metadata and access links are excluded from
the prompt. The key is sent only in the server request's authentication header,
not the URL, browser or prompt. Use synthetic coursework examples and review the
provider's data-use terms. The app saves no conversation transcript.

## 5. Verification and remaining checks

Development-workspace checks:

- 103 backend tests passed on an isolated PostgreSQL 18.6 database.
- Gemini tests cover the native request format, server-only key header, candidate
  IDs, structured output, thought-part filtering, refusal, malformed/truncated
  replies, quota exhaustion, no retries/fallback, unsupported models and blocking
  production calls.
- API tests confirm that quota failure does not prevent saving an opportunity.
- Existing catalogue visibility/verification, session, CSRF and earlier workflow
  tests remain in the full suite.
- OpenAPI specification validation and clean patch import passed.
- The frontend is unchanged by this follow-up. Its previous two tests, production
  build and browser checks passed with the two US10 patches.

Provider responses were simulated. No live Google key, account eligibility,
quota, regional use decision, model response quality or your Mac was verified.
No real OpenAI or Gemini request was made during these automated checks.

To run the backend checks with TEST_DATABASE_URL already set in private .env:

```bash
cd ~/Documents/AI-Foundry-/backend
npm test
```

After checking your changes, push normally:

```bash
cd ~/Documents/AI-Foundry-
git log -3 --oneline
git status
git push origin feature/backend
```

PR addition:

> Switched the US10 checker to Gemini for private developer experiments, using a
> Google Free-tier project with billing disabled. Kept catalogue access checks,
> structured responses and Submit anyway. Added safe quota handling, no provider
> fallback and a production guard. 103 backend tests passed with simulated provider
> responses. Live credentials/quota still need a local check. This is not a free
> shared-site deployment configuration for UK users.

## Official references checked on 26 November 2026

- API keys: https://ai.google.dev/gemini-api/docs/api-key
- Billing tiers: https://ai.google.dev/gemini-api/docs/billing
- Model/pricing: https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite
- REST API: https://ai.google.dev/api/generate-content
- Terms and regional use conditions: https://ai.google.dev/gemini-api/terms
