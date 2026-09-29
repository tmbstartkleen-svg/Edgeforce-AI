# Edgeforce AI

EV-first sports probability intelligence platform.

## Current build — V19 Live Data Intelligence

### Added in V19
- provider-by-provider confidence scoring
- weighted provider price reconciliation
- provider agreement / dispersion scoring
- closing-line value calculations
- CLV summary by sport
- calibration map by sport, market, and probability bucket
- provider-confidence API
- reconciliation and closing-line persistence
- live intelligence panel in the dashboard
- migration gate advanced through V19

### V19 APIs
- `GET /api/intelligence/clv`
- `GET /api/intelligence/calibration-map`
- `GET /api/intelligence/provider-confidence`

### Intelligence model
Provider confidence blends:
- runtime provider health
- latency and error behavior
- historical CLV
- calibration
- sample size
- cross-provider agreement

Provider prices can then be reconciled into one confidence-weighted implied probability before downstream model evaluation.

### Database
Apply migrations through:
```
db/v19.sql
```

All V17/V18 release, smoke, load, monitoring, and rollback safeguards remain active.

## Guardrails
- CLV and calibration are performance diagnostics, not guarantees.
- Positive EV does not guarantee profit.
- Low-quality market inputs can still be suppressed.
- Portfolio and drawdown limits remain active.
- Edgeforce may recommend **NO BET**.
