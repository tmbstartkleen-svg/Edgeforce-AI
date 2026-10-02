# Edgeforce AI

Production-hardened cross-market sports probability, simulation, parlay, bankroll and model-learning workspace.

## Current build — V30 Production Hardening

V30 is the final planned major build in the V26–V30 release sequence. It centralizes release identity, separates liveness from readiness, records operational health, hardens hosted preview verification, and adds an auditable release-attestation path.

### V30 production controls
- one central release manifest: app `30.0.0`, model `edgeforce-v30`, migration `v29`
- dedicated liveness: `GET /api/health/live`
- dedicated readiness: `GET /api/health/ready`
- release readiness: `GET /api/release/readiness`
- strict production checks for database, migration state, required secrets, bankroll configuration and operational odds providers
- hourly operational heartbeat persisted when a database is configured
- readiness failures can create runtime incidents
- sampled live-board latency telemetry
- unified operations status with heartbeats, release attestations, incidents and 24-hour performance
- release attestation endpoint for tested preview artifacts; build, smoke, and load flags must be explicitly true
- local and hosted smoke suites validate V30 version/migration identity
- load gate enforces zero request failures and a configurable p95 ceiling
- Vercel CLI pinned in preview, release and rollback workflows
- exact prebuilt preview artifact is smoke-tested before optional promotion

### Release endpoints
- `GET /api/health/live`
- `GET /api/health`
- `GET /api/health/ready`
- `GET /api/release/readiness`
- `POST /api/release/attest`
- `GET /api/diagnostics`
- `GET /api/ops/status`
- `GET /api/ops/performance`
- `GET /api/ops/incidents`
- `GET /api/providers/health`

### V29 retained
- settled-outcome feedback into Model Council predictions
- calibration buckets, Brier score, log loss, ROI and CLV
- holdout and walk-forward validation
- shrinkage-capped promoted model weights
- calibration/backtest APIs and dashboard

### V28 retained
- provider health scoring, payload quality gates and circuit breaker
- normalization-aware failover
- stale live/stored data rejection
- degraded-mode disclosure

### V27 retained
- persistent wager/leg ledger
- automatic result reconciliation and settlement
- bankroll, ROI, hit-rate and probability-band analytics

### V26 retained
- sportsbook raw/de-vig probability
- prediction-market liquidity matching
- model-vs-book/model-vs-market edge
- conservative quarter-Kelly

### Production guardrails
- Liveness does not imply readiness.
- Production readiness fails closed when required dependencies are missing.
- The expected database migration must be present when production readiness is strict.
- Stale/invalid provider data is not silently treated as live.
- Small or unstable historical samples cannot automatically move model weights.
- Missing outcomes, payouts or prediction-market data are not fabricated.
- Model probabilities and historical performance do not guarantee future results.
