# Edgeforce V118 — Worker-Safe Prediction Intelligence

V118 closes the Cloudflare production blocker exposed after V117.

## Verified V117 production findings

V117 successfully repaired:
- the legacy PostgreSQL provider-column migration path
- exact Cloudflare release identity convergence
- live FanDuel pulse continuity
- degraded hosted expert-model contracts
- Vercel build, migration validation, release audit, smoke, and load gates

The remaining Cloudflare production failure occurred only while priming the prediction-intelligence warehouse. The Worker returned Cloudflare error 1102 while processing the large cross-venue prediction workload.

## V118 fixes

### Worker-safe bounded prediction prime

Cloudflare production now uses an explicit bounded execution profile:
- retained prediction contracts: 300 max
- Kalshi public markets: 1 page, 150 rows max
- Polymarket public markets: 150 rows max
- recent trades: 100 per venue
- leaderboard rows: 25
- cross-venue analysis rows: 40
- generated decision signals: 50

The higher-volume defaults remain available outside the Cloudflare Worker runtime.

### Runtime execution evidence

The prediction cron now returns an `executionProfile` describing the active platform and limits. The Cloudflare production gate requires:
- `cloudflareBounded === true`
- contract limit <= 300
- trade limit <= 100
- successful all-prediction-markets response

This prevents a deploy from passing if the Worker silently falls back to the old high-cost workload.

### Upstream workload reduction

V118 reduces actual fetched input sizes, not only final output:
- Kalshi page size is now runtime-configurable
- Cloudflare caps Kalshi to 150 markets
- Cloudflare caps Polymarket Gamma requests to 150 markets
- Cloudflare retains no more than 300 combined prediction contracts

## Vercel remediation canary

V117 also proved the Vercel candidate through hosted smoke, release attestation, execution certification, strict launch doctor, and SLO remediation before the comparative canary blocked promotion.

V118 repairs that path without weakening regression protection:
- production observability resolves legacy snapshot timestamp columns from the live schema instead of assuming `pulled_at`
- quota-continuity certification tolerates only the known `settle` dependency on an unconfigured RESULTS provider and the known `decision` dependency on a full normalized sportsbook slate
- all other automation failures remain blocking
- inherited CRITICAL/PROTECTIVE state can pass the comparative canary only when fresh real pulse continuity is active and critical checks, incidents, automation failures, circuits, and reliability do not regress versus the production baseline
- the production workflow now parses the certification payload and requires `certified:true` with zero blockers before advancing

This preserves fail-closed behavior for new regressions while allowing a certified remediation candidate to replace an already degraded historical production baseline.

## Identity

- build: V118
- app: 118.0.0
- package: 0.118.0
- model: edgeforce-v118
- migration: v114
