# Edgeforce AI

Production-hardened sports probability, simulation, repricing, line-movement, CLV, parlay, bankroll and model-learning workspace.

## Current build — V32 Line Movement + CLV Intelligence

V32 adds market-movement intelligence and automatic closing-line tracking on top of V31 automatic context repricing.

### V32 line movement
- opener and current odds from persisted market snapshots
- opener and current implied/no-vig probability
- signed probability movement and odds movement
- 30-minute steam detection
- WATCH steam at >=2.0 probability-point movement
- STRONG steam at >=3.5 probability-point movement with at least three snapshots
- live-board steam count and per-row opener/current movement
- `GET /api/intelligence/line-movement` for recent movement history

### Automatic closing line + CLV
- settlement backfills the final valid pre-start market snapshot when a closing price is missing
- provider-supplied closing prices are also normalized into closing implied probability
- signed CLV is persisted on each wager leg
- positive CLV means the closing implied probability moved in the bettor's favor relative to the offered line
- wager-leg CLV is merged into the existing `/api/intelligence/clv` analytics

### Release identity
- build: `V32`
- app: `32.0.0`
- package: `0.32.0`
- model: `edgeforce-v32`
- migration: `v31`

### Retained from V31
- automatic injury / lineup / starter / goalie / quarterback / weather / player-projection repricing
- Postgres-backed context state for serverless continuity
- context-change audit history
- triggered model-run persistence
- live/stored provider-based repricing endpoints

### Production guardrails
- stale, stored and demo data remain explicitly labeled
- closing prices are taken only from observed provider snapshots at or before event start
- missing closing prices are left missing rather than invented
- steam is a market-movement signal, not a guarantee of outcome
- CLV and model probabilities are descriptive/analytic metrics and do not guarantee profit
