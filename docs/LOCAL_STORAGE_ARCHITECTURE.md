# Local storage architecture

The application has no hosted database dependency. React state is initialized from browser `localStorage` and persisted back whenever the active local workspace changes.

## Main data groups

- Requisitions and candidate collections use `talentSonar:local-workspace-*` keys.
- Talent pools, engagement preferences, recruiter tasks, SLA settings, comments, and collaborators use `talentSonar:local-workspace:operations`.
- Pipeline events, interview schedules, interview sessions, decision artifacts, recruiting scorecards, intake scorecards, sourcing runs, and analytics snapshots use dedicated `talentSonar:*` keys.

## Operational implications

- Data is available offline after the app has loaded.
- Data does not synchronize across browsers, devices, or users.
- Browser storage is not appropriate as a production system of record for sensitive recruiting data.
- Clearing site data removes the local workspace. Export or backup features should be added before production use.
- Multi-user authentication, centralized audit retention, and server-enforced authorization are intentionally absent in this edition.
