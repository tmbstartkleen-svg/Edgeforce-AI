# Edgeforce AI

Cross-market sports probability, simulation, parlay and bankroll intelligence workspace.

## Current build — V28 Provider Resilience + Data Quality Control

V28 hardens every external provider path so a successful HTTP response is no longer enough to contaminate the model. Providers are scored on reliability and payload quality, stale or unusable feeds are rejected, repeated failures open a circuit breaker, and the board clearly identifies fallback/degraded mode.

### V28 provider hardening
- payload-quality inspection before provider acceptance
- capability-specific freshness limits
- empty/unusable odds, stats and prediction-market payload rejection
- odds-specific normalization validation before a provider is accepted
- provider health score combines error rate, latency, freshness and payload quality
- configurable consecutive-failure circuit breaker
- configurable provider quarantine/cooldown window
- expired circuits re-enter through a half-open probe
- persistent failure reason, quality grade and payload-age audit data
- provider health API exposes circuit state and quarantine status
- stale stored odds are rejected after a configurable grace period
- explicit degraded-mode disclosure when live data cannot be trusted

### Default resilience controls
- `PROVIDER_FAILURE_THRESHOLD=3`
- `PROVIDER_QUARANTINE_MIN=5`
- `ODDS_STORED_MAX_AGE_MIN=90`
- odds payload freshness limit: 20 minutes by default

Each provider can override its own freshness, failure and quarantine settings with:
- `<PROVIDER>_MAX_AGE_MIN`
- `<PROVIDER>_FAILURE_THRESHOLD`
- `<PROVIDER>_QUARANTINE_MIN`

### Data-quality rules
- Live odds must normalize into at least one valid market.
- Payload timestamps are inspected at the envelope and row level.
- Timestamps supplied as Unix seconds or milliseconds are supported.
- Stale feeds fail over instead of silently entering simulations.
- When every live provider is rejected, only sufficiently recent stored odds may be used.
- If stored odds are also stale, the interface identifies demo/degraded mode instead of presenting them as live.

### Existing intelligence retained
- V27 automated wager settlement and persistent bankroll ledger
- V26 cross-market sportsbook/prediction-market consensus
- sport-specific Monte Carlo engines
- Model Council and learned model weights
- player/lineup context and SGP correlation
- bankroll controls and performance analytics

### Relevant APIs
- `GET /api/live-board`
- `GET /api/providers/health`
- `GET /api/diagnostics`
- `GET /api/health`
- `GET /api/testing/provider-failure` when test endpoints are enabled
- `GET /api/testing/payload-quality` when test endpoints are enabled

### Guardrails
- HTTP 200 responses can still be rejected when data quality fails.
- Quarantined providers are not used until their cooldown expires.
- Empty or stale critical feeds are not treated as trustworthy live data.
- Fallback data is explicitly labeled.
- Missing provider data is not fabricated.
- Simulation probabilities remain estimates, not guarantees.
