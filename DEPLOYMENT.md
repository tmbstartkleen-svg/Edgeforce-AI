# Edgeforce AI V35 deployment

## Release strategy
lint → build → migration continuity → local production server → smoke → load gate → Vercel prebuilt preview → hosted smoke → release attestation → optional exact-artifact promotion → observe → rollback if needed.

## Required production configuration
Configure `DATABASE_URL`, `INGEST_SECRET`, `CRON_SECRET`, `MODEL_VERSION=edgeforce-v35`, a positive `DEFAULT_BANKROLL`, and at least one authorized odds provider. Apply database migrations through `v34`.

GitHub Actions deployment also requires `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`.

## Health model
- `/api/health/live`: process liveness only.
- `/api/health/ready`: environment-aware service readiness.
- `/api/release/readiness`: release/dependency details without secret values.
- In production, readiness requires database connectivity, migration v34, secrets, bankroll configuration and an operational odds provider.

## Pre-release gates
- `npm run lint`
- `npm run build`
- `npm run check-migrations`
- local production-server smoke suite
- load check with zero failures and configured p95 ceiling
- hosted preview liveness/readiness/diagnostics/ops-status/dashboard checks
- V35 version and migration identity checks

## Preview and promotion
Use **Edgeforce Release Candidate**. It builds a Vercel preview with pinned CLI tooling, smoke-tests the exact prebuilt artifact, records a release attestation, and promotes that same artifact only when `promote=true`.

## Rollback
Use **Edgeforce Rollback** with an optional deployment URL/ID. The Vercel CLI is pinned to the V35 release toolchain.

## Observability
The hourly heartbeat records readiness when a database is configured. `/api/ops/status` surfaces recent heartbeats, release attestations, unresolved incidents and route performance. Live-board performance sampling is controlled with `PERFORMANCE_SAMPLE_RATE`.

## Performance defaults
- `PERFORMANCE_SAMPLE_RATE=0.10`
- `LOAD_REQUESTS=60`
- `LOAD_MAX_P95_MS=3000`

These can be tightened after observing real production traffic.

## Hobby cron compatibility
Vercel Hobby accepts cron schedules that run at most once per day. The Vercel cron configuration therefore runs settlement and heartbeat once daily for deploy compatibility. Hourly settlement and heartbeat are preserved through `.github/workflows/hourly-ops.yml`, which calls the production endpoints when the GitHub variable `EDGEFORCE_PRODUCTION_URL` and secret `CRON_SECRET` are configured.


## Canonical Vercel production project
The canonical production project is `edgeforce-ai2` (`prj_8edFTZzS8e6RZyMVm1mjxuGJnLPZ`). Repository-level `ignoreCommand` allows Git builds only for that project so the older duplicate `edgeforce-ai` and `edgeforce` projects no longer consume duplicate build quota.

## Automatic prebuilt production deployment
After **Verify Edgeforce** succeeds on `main`, **Edgeforce Production Deploy**:
1. targets the canonical Vercel project,
2. pulls the production environment,
3. validates the V35 app/model environment,
4. applies database migrations through v34,
5. builds with the pinned Vercel CLI,
6. deploys the prebuilt artifact directly to production,
7. runs hosted V35 smoke/readiness checks,
8. records a release attestation,
9. rolls back automatically if a hosted post-deploy check fails.

This path avoids Vercel's remote build quota because the application artifact is built in GitHub Actions before upload.


## Provider certification
Before production promotion, run an authorized `POST /api/providers/certify` and inspect `GET /api/launch-doctor?strict=1`. A certified ODDS provider is a hard requirement. Optional enrichment capabilities are reported as warnings when missing or degraded. Certification history is persisted when Postgres is configured.


## SGP correlation learning
V35 rebuilds learned same-event market-pair profiles during the scheduled recalibration workflow. Defaults are `SGP_CORRELATION_MIN_SAMPLE=20` and `SGP_CORRELATION_SHRINKAGE_SAMPLES=50`. These profiles supplement—not replace—the structural same-game heuristics. The production deployment remains gated by provider certification and the strict launch doctor.
