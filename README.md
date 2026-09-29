# Edgeforce AI

EV-first sports probability intelligence platform.

## Current build — V13

V13 turns the V12 operating console into an interactive control room.

### Added in V13
- Click-to-inspect market/game drill-down
- Full Model Council vote breakdown
- Market line-history endpoint
- Lightweight line-movement charts
- Bankroll/equity curve
- Alert acknowledgment
- Read-only what-if repricing
- Read-only portfolio scenario testing
- Scenario-run database
- Drill-down audit database
- Interactive decision and position rows

### V13 API
- `GET /api/market/[id]`
- `GET /api/market/[id]/lines`
- `POST /api/alerts/[id]/ack`
- `POST /api/what-if`
- `GET /api/bankroll/curve`

### Read-only scenario behavior
The what-if endpoint recalculates:
- model probability
- scan metrics
- expected value
- portfolio allocation

without changing historical prediction, market snapshot, or settlement records.

### Database migrations
Apply in order through:

```
db/v13.sql
```

## Guardrails
- What-if runs do not mutate historical records.
- Alert acknowledgment only resolves the alert; it does not alter market data.
- Positive EV does not guarantee profit.
- Live-data freshness remains visible.
- Portfolio and drawdown limits override individual market attractiveness.
- The 30% daily gain display remains a target, not a promise.
- Edgeforce may recommend **NO BET**.
