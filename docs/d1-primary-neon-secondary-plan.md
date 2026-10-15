# EdgeForce storage transition: D1 primary, Neon secondary

Status: **NOT CUT OVER**. This document describes a desired topology, not a completed production migration.

## Current proven topology

- Main Worker uses `src/lib/db.ts` PostgreSQL client for application persistence. The protected deployment still runs the PostgreSQL migrations before deploying.
- Cloudflare `INTELLIGENCE_DB` D1 binding exists, but the D1 gateway is a bounded intelligence-observation pilot, gated by `INTELLIGENCE_D1_WRITE_ENABLED`. Its schema is not equivalent to the full PostgreSQL application schema.
- Neon is currently configured as primary application persistence. Do not remove the database URL or skip migrations until the cutover is certified.

## Target topology

- **Primary:** Cloudflare D1 for application writes and reads, after feature-by-feature schema parity, transactions, identifiers, access control and backfill verification.
- **Secondary:** Neon as a separately verified backup/analytics or failover destination. A Neon quota error must be visible, not silently ignored. Secondary is **not** automatic active-active or synchronous failover without replicated writes and reconciliation.
- Records carry source identity, event/market/selection keys, observed timestamps, provenance and deduplication keys. Never convert public fixture data into claimed sportsbook odds.

## Cutover gates

1. Inventory every PostgreSQL table, query and migration used by games, user accounts, model runs, betting markets, bets, settlement, backtests and scheduled jobs. Map each one to a tested D1 implementation; account for SQL dialect and transactional behavior.
2. Verify live D1 bindings, D1 schema migrations, access control, application reads/writes, Worker CPU/subrequest budget, and cron processing.
3. Back up the PostgreSQL data, export the required records, import them with checksums and row-count reconciliation. Confirm incremental changes and a documented rollback window.
4. Implement controlled synchronization or replay into Neon with independent verification, bounded cost, secure credentials, and explicit staleness/recovery metrics. Secondary failure must not corrupt D1.
5. Run a read-only shadow phase, a bounded canary, strict API/data-quality/SLO checks, and settlement/identity verification before enabling D1 writes for the application.
6. Only then update production deployment migrations, secrets and database selection. Keep the old PostgreSQL primary intact until rollback evidence is archived.

Run `node scripts/storage-topology-gate.mjs`. `EDGEFORCE_PRIMARY_STORAGE=d1 node scripts/storage-topology-gate.mjs` intentionally exits nonzero until the *entire* application cutover is implemented and certified. Never override the gate just to get a green deployment. The current Neon quota failure on deployment #584 remains unresolved.
