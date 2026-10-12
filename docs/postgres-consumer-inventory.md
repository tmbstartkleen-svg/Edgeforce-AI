# EdgeForce Postgres dependency inventory — incremental Neon-to-D1 migration

This is an inventory, **not** a claim that Neon has been migrated. D1 pilot is operational separately. No existing data has been deleted.

## Verified Postgres integration points
- `src/lib/db.ts`: Postgres socket/client lifecycle, request-scoped Cloudflare database access and health checks; requires rewriting as D1-native context.
- `scripts/migrate.mjs` and `db/schema.sql`: historical Postgres schema and migrations; preserve for recovery.
- `scripts/cloudflare-runtime-secrets.mjs`: requires `DATABASE_URL` in production secret bundle.
- `.github/workflows/deploy-cloudflare.yml`: manual-only deployment still requires database URL and Postgres migration. Deliberate fail-closed gate until migration completes.
- `package.json`: `postgres` runtime dependency; cannot yet remove without changing clients.
- `wrangler.jsonc`: D1 binding present but original application still expects Postgres.

## Application consumers surfaced by repository code search for db()
| Category | Known files | D1 migration consideration |
|---|---|---|
| Market observations | `src/lib/persistence.ts`, `src/lib/lineMovement.ts`, `src/app/api/line-moves/route.ts` | Schematize sportsbook quotes and line histories; preserve provider/event IDs |
| Player records | `src/app/api/players/route.ts`, `src/app/api/player/[id]/route.ts`, `src/app/api/positions/route.ts` | Rebuild athlete identifiers and historical player stats |
| Injuries and games | `src/lib/liveInjuryTracking.ts`, `src/lib/eventTruth.ts` | Preserve observed-at/source timestamps, event truth and settlement history |
| Audits and decisions | `src/lib/providers/audit.ts`, `src/lib/decisionJournal.ts`, `src/lib/ops.ts` | Durable event and decision audit tables |
| Monitoring and release | `src/lib/opsStatus.ts`, `src/lib/productionLaunch.ts`, `src/lib/automationHealth.ts`, `src/lib/runtimeMigrations.ts` | D1-backed production readiness and migration tracking |
| Dashboard and alerts | `src/lib/consoleData.ts`, `src/lib/alertStore.ts`, `src/app/api/alerts/route.ts`, `src/app/api/db/stats/route.ts` | D1 read adapters and archival behavior |

These are confirmed examples from repository search, **not a complete dependency graph**. Additional consumers may import helper functions indirectly; find them before disabling Postgres.

## Migration order
1. Verify saved historical Neon backups, per-table counts and hashes before any deletion; suspended Neon access currently prevents parity checks.
2. Add matching D1 schemas for game/player/team, sportsbook, decision journal, prediction contracts and operational views; keep existing D1 tables append-only.
3. Migrate narrow, independently testable read paths (sports markets and alerts) behind explicit D1 feature flags.
4. Migrate write paths with source/license gates, original timestamps and quotas; certify real hosted observations.
5. Backfill validated historical data and test parity and forecast behavior with fresh and old datasets.
6. Only after application parity and certified deployment, remove `postgres` from dependencies, remove old migrations, clean runtime secrets, and make D1 primary in the full production Worker.

## Repo workflow cleanup already complete
PR #303 merged. The main Cloudflare/ML deployments no longer auto-trigger from verification; manual production release remains available. The separate Cloudflare dashboard Git integration must be disabled in its own UI.
