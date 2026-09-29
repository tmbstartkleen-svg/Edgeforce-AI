# Edgeforce AI

EV-first sports probability intelligence platform.

## Current build — V10

V10 adds portfolio and bankroll intelligence on top of V9 historical learning.

### Added in V10
- Bankroll-aware position sizing
- Daily and weekly risk budgets
- Maximum position size
- Maximum event exposure
- Maximum sport exposure
- Correlated-exposure cap
- Drawdown brake that automatically cuts risk
- Portfolio-level expected profit and ROI
- Rejection reasons when a wager breaches risk rules
- Cash-out offer versus modeled hold-value comparison
- Hedge sizing helper
- Bankroll accounts
- Open-position storage
- Portfolio snapshots
- Cash-out evaluation history
- Risk-budget history

### Portfolio logic
Edgeforce no longer treats each positive-EV market independently.

A candidate can be rejected even when it has positive EV if:
- too much bankroll is already exposed to the same event
- the same sport is over-concentrated
- correlated positions exceed the portfolio limit
- the daily risk budget is exhausted
- drawdown has triggered reduced sizing

### V10 API
- `POST /api/portfolio/optimize`
- `POST /api/cashout`
- `POST /api/hedge`

### Cash-out logic
Cash-out offers are compared with current modeled hold value rather than automatically assuming cashing out is beneficial.

### Database migrations
Apply in order:

```
db/schema.sql
db/v6.sql
db/v7.sql
db/v8.sql
db/v9.sql
db/v10.sql
```

## Guardrails
- Positive expected value does not guarantee profit.
- Kelly sizing is capped and further constrained by portfolio limits.
- The 30% daily gain display remains a target, not a promise or required objective.
- Drawdown can automatically reduce exposure.
- Correlation and concentration can cause a positive-EV wager to be rejected.
- Edgeforce may recommend **NO BET**.
- Production feeds should be licensed or otherwise authorized.
