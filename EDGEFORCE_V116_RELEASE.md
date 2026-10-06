# Edgeforce V116 — Runtime Contract Convergence

V116 repairs the final runtime-contract mismatches exposed by V115.

## Verified V115 findings

Vercel successfully:
- built the staged preview-target remediation artifact
- deployed the candidate
- applied migrations
- certified quota continuity from the live FanDuel pulse
- recorded launch stages through launch-doctor
- reached hosted remote smoke

The hosted smoke then failed because several feature endpoints were still compared against historical build labels such as V61 even though their schema contracts remained valid.

Cloudflare successfully:
- deployed V115
- converged to the exact release identity
- certified FanDuel pulse continuity
- passed usable-live-data verification
- passed prediction-terminal and PWA checks
- primed prediction intelligence in degraded mode with real Polymarket data

Strict launch doctor still failed because readiness counted only full normalized odds providers as operational even while a fresh real FanDuel pulse was already certified. Prediction persistence also revealed an obsolete legacy NOT NULL `provider` column on `prediction_market_snapshots`.

## V116 fixes

### Schema-based hosted smoke

Historical feature routes now validate their stable schema versions and response invariants rather than requiring the endpoint to report an old release build label.

Current release identity remains verified through the dedicated health/release identity endpoints.

### Pulse-aware strict readiness

Strict readiness now recognizes a fresh FanDuel pulse with real prices as operational continuity when all configured full-odds providers are quarantined.

The readiness payload explicitly reports pulse continuity, price count, and pulse age; it does not relabel the pulse as a full normalized sportsbook provider.

### Legacy prediction snapshot constraint repair

The migration compatibility bridge now detects an obsolete legacy `provider` column on `prediction_market_snapshots`.

When present:
- blank/null legacy provider values are backfilled from venue
- the obsolete NOT NULL requirement is removed
- canonical venue-based snapshot inserts can proceed without populating a deprecated provider field

## Identity

- build: V116
- app: 116.0.0
- package: 0.116.0
- model: edgeforce-v116
- migration: v114
