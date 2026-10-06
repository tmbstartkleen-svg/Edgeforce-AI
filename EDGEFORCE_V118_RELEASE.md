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

## Identity

- build: V118
- app: 118.0.0
- package: 0.118.0
- model: edgeforce-v118
- migration: v114
