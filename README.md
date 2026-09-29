# Edgeforce AI

EV-first sports probability intelligence platform.

## Current build — V11

V11 adds the autonomous decision layer on top of V10 portfolio intelligence.

### Added in V11
- Position lifecycle states: CANDIDATE, OPEN, HOLD, REDUCE, HEDGE, CASH_OUT, REMOVE, SETTLED
- Autonomous portfolio decision engine
- Event-driven repricing endpoint
- Stale-line alerts
- Edge-change alert primitives
- Decision journal with reasons and before/after state
- Persistent alert storage
- Repricing event storage
- Open-position current probability/EV tracking
- Scheduled decision pass after market scans
- Automatic removal when a market disappears from the active scan
- Drawdown-aware lifecycle changes
- Correlation-breach reductions
- Cash-out actions integrated into lifecycle logic

### Decision philosophy
Edgeforce does not automatically place wagers. It generates and records a recommended lifecycle action based on the latest modeled information.

Possible actions:
- OPEN
- HOLD
- REDUCE
- HEDGE
- CASH_OUT
- REMOVE
- SETTLED

Every action includes machine-readable reasons such as:
- stale market data
- positive or negative EV
- model agreement
- portfolio exposure limit
- correlation breach
- drawdown brake
- cash-out value

### V11 API
- `POST /api/decision/run`
- `POST /api/events/reprice`
- `GET /api/alerts`
- `GET /api/decision/journal`
- `GET /api/cron/decision`

### Scheduling
Vercel cron remains the safety-net scheduler. Live odds, injury, weather, or result providers can also call event endpoints immediately when new information arrives.

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
```

## Guardrails
- Edgeforce provides analytical decisions, not guaranteed outcomes.
- Positive EV can disappear after repricing.
- Stale prices are removed rather than treated as actionable.
- Portfolio exposure and drawdown limits override individual bet attractiveness.
- The 30% daily gain display remains a target, not a promise.
- The system may recommend **NO BET**.
- Production feeds should be licensed or otherwise authorized.
