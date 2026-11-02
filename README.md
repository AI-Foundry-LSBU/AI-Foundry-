# AI Foundry Opportunity Tracker

A web application for LSBU staff to submit improvement opportunities to
the AI Foundry. The Digital Project Manager can review and prioritise
submissions, while the AI Foundry team can track approved work and its
benefits.

This project is being developed by a student team for the ICT Project
Management module, using the AI Foundry Project Initiation Document as
its starting point.

## Technology

- **Frontend:** React with Vite
- **Backend:** Node.js with Express
- **Database:** PostgreSQL
- **API:** REST, documented in `openapi.yaml`

## API contract

The API contract is in [`openapi.yaml`](./openapi.yaml). It defines the
endpoints, request and response formats, user roles and expected
behaviour for the frontend and backend.

Treat this file as the shared reference when implementing the API.
Discuss proposed changes with the frontend and backend developers before
changing it, then submit the change for review.

The local API base URL is:

```text
http://localhost:3000/api/v1
```

For the Sprint 1 demo, requests use the `X-User-Email` header to
identify a seeded demo user. This is a temporary development
arrangement, not production authentication. See `openapi.yaml` for the
expected roles and API details.

## Repository guidance

- Keep frontend and backend work on separate feature branches.
- Do not commit directly to `main`; use a pull request for review.
- Include the user story or task ID in commit messages where relevant.
- Do not commit `node_modules`, `.env` files, credentials or other
  secrets.
- Keep project documentation and sprint evidence in the repository's
  documentation folders.

## Running the project

Local setup instructions will be added when the frontend and backend
folders, environment variables and npm scripts are finalised. Check with
the team before assuming a development command or configuration value.
