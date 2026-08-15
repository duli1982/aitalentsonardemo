# Talent Sonar

Talent Sonar is a Vite and React recruiting workspace. This edition is local-first: requisitions, candidates, talent pools, recruiter tasks, engagement records, pipeline events, scorecards, interviews, and settings are stored in the browser for the active local workspace.

## Run locally

Prerequisite: Node.js.

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` if you want to configure the optional Gemini AI gateway or Google Drive integration.
3. Start the app with `npm run dev`.
4. Validate changes with `npm run typecheck`, `npm test`, and `npm run build`.

## Persistence model

- No hosted database client, migration scripts, database credentials, authentication service, or row-level policies are required.
- Browser data is scoped under `talentSonar:local-workspace` local-storage keys.
- CV and CSV imports write into the same local candidate collection.
- Search, ranking, workforce planning, pipeline activity, scorecards, collaboration records, and analytics read from local workspace data.
- Clearing browser site data removes workspace records. Data is specific to the current browser profile and is not synchronized between devices.

## Optional AI gateway

Server-side routes cover AI generation, embeddings and resume parsing, governed publishing, WhatsApp delivery and signed webhooks, and approved Google/Outlook calendar creation. Credentials remain server-only. The core workspace remains usable without provider credentials; connector actions truthfully show as unavailable until configured.

The **Screening & Plans** workspace creates evidence-backed candidate screening sessions, captures channel/frequency/locale/time preferences and talent-community consent, stores client-specific pool criteria, generates approval-gated engagement strategies, routes work between recruiters and agent assistance, and schedules only human-approved recruiter calls. Candidate invitation links use `/screen/:organizationId/:token`.

This repository currently uses organization-scoped browser persistence rather than a shared database. Candidate invitation links therefore share live state only within the same deployed browser/storage environment. Production multi-device or public candidate journeys require a durable server-side store.

See [Local storage architecture](docs/LOCAL_STORAGE_ARCHITECTURE.md) for the storage and migration implications.
