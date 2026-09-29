# Edgeforce AI

EV-first sports probability intelligence platform.

## Current build — V12

V12 turns Edgeforce into a live operating console on top of the V11 autonomous decision engine.

### Added in V12
- Unified console snapshot API
- Live alert center
- Decision timeline
- Open-position manager
- Bankroll state
- Model-health panel
- Repricing / line-movement feed
- 30-second console refresh in the UI
- Database-backed console data when DATABASE_URL is configured
- Demo / no-database status when persistence is unavailable
- Console audit/preferences database tables

### V12 API
- `GET /api/console`
- `GET /api/positions`
- `GET /api/model-health`
- `GET /api/bankroll/history`
- `GET /api/line-moves`

### Operating flow
1. Odds, weather, injuries, and results enter the ingestion layer.
2. Markets are repriced.
3. The decision engine rebuilds lifecycle actions.
4. Alerts and decisions are persisted.
5. The live console reads current positions, alerts, decisions, bankroll, model health, and repricing activity.
6. The UI refreshes the operating state every 30 seconds.

### Database migrations
Apply in order:

```
db/schema.sql
db/v6.sql
db/v7.sql
db/v8.sql
db/v9.sql
db/v10.sql
db/v11.sql
db/v12.sql
```

## Guardrails
- Edgeforce remains an analytical decision-support system.
- Positive EV does not guarantee profit.
- Stale or missing live data is surfaced instead of silently treated as current.
- Portfolio and drawdown limits override individual market attractiveness.
- The 30% daily gain display remains a target, not a promise.
- Edgeforce may recommend **NO BET**.
- Production feeds should be licensed or otherwise authorized.
