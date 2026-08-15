# CSV candidate ingestion

The `csv` connector imports candidates through `POST /api/ingestion/csv`. It requires a signed-in user with an active organization and an `owner`, `admin`, or `recruiter` membership role.

Use the **CSV candidate import** card on `/ingest`, or call the endpoint with a bearer token and the `X-Talent-Sonar-Organization-Id` header.

## Accepted columns

`Name` or `Full Name` is required. The connector also recognizes `Email`, `Phone`, `Location`, `Title`/`Role`, `Experience Years`, `Skills`, and `Summary`.

`Skills` may be separated by commas, semicolons, or pipes. CSV quoting and escaped quotes are supported.

## Persistence behavior

Each valid row creates or updates an organization-scoped `candidates` record. A matching email updates the existing candidate in that organization; the connector then creates an active `candidate_documents` snapshot and deactivates the previous active snapshot.

Imports are limited to 2 MB and 250 rows per request. Row-level validation failures are reported without discarding valid rows.

CSV imports intentionally do not create embeddings synchronously. This keeps ingestion deterministic and bounded; the upcoming durable worker should backfill embeddings for `source = 'csv_connector'` documents.
