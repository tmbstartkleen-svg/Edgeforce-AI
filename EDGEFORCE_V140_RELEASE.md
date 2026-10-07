# Edgeforce V140 — Governor Telemetry, Recovery Forecast, and Dashboard

V140 adds live observability to the V139 shared Vercel deployment governor.

A server-only telemetry service reads the team deployment window using the protected production Vercel token, pages the rolling 24-hour deployment history, calculates project-level usage and deployment-state counts, and predicts how many deployments must age out before the normal 84-slot automation budget can resume.

The telemetry distinguishes normal capacity, emergency-reserve usage, and over-hard-cap conditions. Each governed project is labeled CURRENT, ACTIVE, APPROVED, or DEFERRED with an explicit reason, using repository activity, latest deployment time, cooldown state, and the shared team budget.

Snapshots are persisted to Postgres no more than once every 15 minutes in the new v115 schema. The dashboard consumes only the sanitized telemetry API; the Vercel credential is never returned to the browser.

The new dashboard panel shows team usage, reserve consumption, over-cap pressure, slots required for recovery, predicted next normal slot time, per-project accounting, deployment-state totals, and recent governor history.
