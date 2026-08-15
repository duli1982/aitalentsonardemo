# Greenhouse and Lever job intelligence

The job-intelligence integration syncs published public careers-board jobs into `external_job_postings`, without requiring a Greenhouse or Lever API key.

- Greenhouse uses the Job Board endpoint `GET /v1/boards/{board_token}/jobs?content=true`.
- Lever uses the public Postings endpoint `GET /v0/postings/{site}?mode=json`.

Run `sql/JOB_INTELLIGENCE_SETUP.sql`, then open **Data Ingestion** and enter the board token (Greenhouse) or site name (Lever). The server validates tokens, fetches only the provider’s fixed public endpoint, normalizes job title/department/location/description/application URL, and scopes all stored data to the active organization.

These are external market-intelligence records. They do not overwrite the organization’s internal `jobs` table.
