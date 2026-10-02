# Edgeforce AI

Production-hardened sports probability, simulation, repricing, parlay, bankroll and model-learning workspace.

## Current build — V31 Automatic Context Repricing

V31 extends the V30 production-hardened platform with automatic material-change detection and auditable re-simulation. Fresh provider pulls are compared with the prior persisted market/context state. Material changes trigger a new scan immediately and retain the post-change model run.

### V31 automatic triggers
- sportsbook line / implied-probability movement
- injury context changes
- lineup changes
- starter designation changes
- goalie changes
- quarterback changes
- material weather changes
- player status changes
- player availability changes of at least 5 percentage points
- player projection changes of at least 0.5 units or 3%

### Re-simulation and repricing flow
1. Pull the latest live/stored market feed.
2. Fuse weather, injuries, stats and player context.
3. Load the prior context state from Postgres when available.
4. Detect material changes.
5. Persist each change event.
6. Persist the new current context state for serverless continuity.
7. Re-run sport-specific simulation and model scoring for affected markets.
8. Persist triggered model-run snapshots.
9. Surface the changed markets, fresh probabilities, EV, grade and simulation engine on the live-board response.

The normal provider refresh cadence remains 10 seconds. `GET /api/live-board?force=1` can bypass the cache only when authorized with the configured ingest secret.

### V31 endpoints
- `GET /api/live-board`
- `GET /api/context-changes`
- `POST /api/reprice`
- `POST /api/events/reprice`
- `GET /api/health/live`
- `GET /api/health`
- `GET /api/health/ready`
- `GET /api/release/readiness`

The reprice endpoints now resolve markets from the current live/stored provider pipeline rather than defaulting to demo markets.

### Release identity
- build: `V31`
- app: `31.0.0`
- package: `0.31.0`
- model: `edgeforce-v31`
- migration: `v30`

### V30 retained
- dedicated liveness and readiness
- production readiness gates
- operational heartbeat and incident tracking
- release attestations
- provider resilience and payload freshness gates
- calibrated model learning
- persistent wager ledger and settlement
- hosted preview smoke testing and promotion workflows

### Guardrails
- Missing provider context is not fabricated.
- A context change only triggers when it crosses a defined materiality threshold.
- Re-simulation outputs remain estimates, not guarantees.
- Forced cache bypass is protected when an ingest secret is configured.
- Provider degraded/stored/demo modes remain explicitly disclosed.
- Repricing history and post-change model runs are retained for audit when a database is configured.
