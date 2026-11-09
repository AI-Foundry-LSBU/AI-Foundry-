# AI Foundry Opportunity Tracker

A web app for LSBU staff to submit requests for improving university processes. The Digital Project Manager can review and prioritise requests, while the AI Foundry team can track projects and their benefits.

Developed as part of the ICT Project Management module, using the AI Foundry Project Initiation Document (PID) as a reference.

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **API:** REST API

## API

The API specification is available in [`docs/api/openapi.yaml`](docs/api/openapi.yaml).

It covers the endpoints, request and response formats, and user roles. Any changes to the API should be discussed with the frontend and backend developers to avoid issues when connecting everything.

**Local API URL:**

```
http://localhost:3000/api/v1
```

For Sprint 1, the `X-User-Email` header is used to identify demo users. This is only for testing and will need to be replaced with proper authentication later.

## GitHub Guidelines

- Use the assigned feature branches, not `main`.
- Create a pull request before merging changes.
- Include Jira task IDs in commit messages where possible.
- Don't commit `node_modules`, `.env` files or sensitive information.
- Keep documentation and sprint evidence in the relevant folders.

## Running Locally

The setup steps are in [`backend/README.md`](backend/README.md). That guide creates the local database, starts the API, and runs the website.

Sign in with `staff@example.com` to submit, track or delete your own requests. Sign in with `manager@example.com` to assess requests and record decisions. The engineer view uses sample data.
