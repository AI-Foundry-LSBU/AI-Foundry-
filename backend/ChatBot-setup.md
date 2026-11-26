## Get a Gemini key for private experiments

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

## Configure backend/.env

Keep all existing database, session and demo-password lines. Add/update:

```
GEMINI_API_KEY=paste_your_own_Gemini_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
```

Replace the placeholder with the actual Gemini key. The model line is a model
name, not a secret. Google currently lists Gemini 3.5 Flash-Lite with free text
input/output on the Free tier. Gemini 3.1 Flash-Lite is the other allowed model
if your private account has access. Other model names fail safely instead of
silently selecting a potentially paid model.
