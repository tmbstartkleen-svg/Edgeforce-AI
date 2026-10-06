# Edgeforce V109 — Production Legacy Bridge Repair

V109 repairs the two production blockers exposed after V108 passed the main verification gate and reached both deployment fan-outs.

## Verified V108 production findings

- `Verify Edgeforce` passed on the V108 main commit.
- Vercel team authorization, project linking, project resolution, and production settings pull all succeeded.
- the current Vercel production release is still `23.0.0`, so the V74 SLO governor endpoint is not present yet.
- the production workflow incorrectly allowed only a V73 bootstrap exception and therefore failed closed before deployment.
- Cloudflare build and Worker validation succeeded.
- Neon migration reached v40 and failed because a legacy `prediction_market_snapshots` table existed without the canonical `venue` column.

## V109 repair contract

### Legacy database compatibility bridge

Before replaying versioned migrations, the migration runner now detects an existing legacy `prediction_market_snapshots` table and reconciles it to the v40 contract:

- adds missing prediction-market snapshot columns idempotently
- backfills required legacy values without dropping the table
- removes duplicate rows only where they collide on the canonical hourly snapshot key
- restores required non-null/default guarantees
- creates the canonical `(venue, contract_id, observed_hour)` unique index required by later upserts

The historical v40 migration can then continue normally instead of failing on its first venue-based index.

### Pre-V74 production SLO bootstrap bridge

The production deployment gate now parses the live production major version. When the currently deployed release is older than V74 and therefore predates the SLO governor endpoint, it performs the existing fail-closed observability safety check as a one-time bridge.

The bridge does **not** allow an unhealthy legacy release to deploy forward: a CRITICAL observability state still blocks production, and releases at V74 or later still require the SLO governor contract.

### Regression evidence

- release audit checks the legacy prediction snapshot bridge
- release audit checks the numeric pre-V74 SLO bootstrap path
- health and local smoke expose and verify the V109 repair capability

## Identity

- build: V109
- app: 109.0.0
- package: 0.109.0
- model: edgeforce-v109
- migration: v114 (unchanged)
