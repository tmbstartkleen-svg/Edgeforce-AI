# Edgeforce AI V30 deployment

## Release strategy
lint → build → migration continuity → local production server → smoke → load gate → Vercel prebuilt preview → hosted smoke → release attestation → optional exact-artifact promotion → observe → rollback if needed.

## Required production configuration
Configure `DATABASE_URL`, `INGEST_SECRET`, `CRON_SECRET`, `MODEL_VERSION=edgeforce-v30`, a positive `DEFAULT_BANKROLL`, and at least one authorized odds provider. Apply database migrations through `v29`.

GitHub Actions deployment also requires `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`.

## Health model
- `/api/health/live`: process liveness only.
- `/api/health/ready`: environment-aware service readiness.
- `/api/release/readiness`: release/dependency details without secret values.
- In production, readiness requires database connectivity, migration v29, secrets, bankroll configuration and an operational odds provider.

## Pre-release gates
- `npm run lint`
- `npm run build`
- `npm run check-migrations`
- local production-server smoke suite
- load check with zero failures and configured p95 ceiling
- hosted preview liveness/readiness/diagnostics/ops-status/dashboard checks
- V30 version and migration identity checks

## Preview and promotion
Use **Edgeforce Release Candidate**. It builds a Vercel preview with pinned CLI tooling, smoke-tests the exact prebuilt artifact, records a release attestation, and promotes that same artifact only when `promote=true`.

## Rollback
Use **Edgeforce Rollback** with an optional deployment URL/ID. The Vercel CLI is pinned to the V30 release toolchain.

## Observability
The hourly heartbeat records readiness when a database is configured. `/api/ops/status` surfaces recent heartbeats, release attestations, unresolved incidents and route performance. Live-board performance sampling is controlled with `PERFORMANCE_SAMPLE_RATE`.

## Performance defaults
- `PERFORMANCE_SAMPLE_RATE=0.10`
- `LOAD_REQUESTS=60`
- `LOAD_MAX_P95_MS=3000`

These can be tightened after observing real production traffic.
