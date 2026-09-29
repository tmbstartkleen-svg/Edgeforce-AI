# Edgeforce AI

EV-first sports probability intelligence platform.

## Current build — V9

V9 adds historical intelligence and adaptive validation on top of the V8 sport-specific engines.

### Added in V9
- Historical prediction ingestion
- Rolling player/stat feature generation
- Exponentially weighted recent-form features
- Opponent-adjusted feature helpers
- Walk-forward train/test backtesting
- Brier score, log loss, ROI, CLV, and max drawdown in backtests
- Dynamic model scoring
- Normalized model weights by sport and market
- Historical model-weight API
- Historical prediction database
- Backtest-run storage
- Learned model-weight storage
- Rolling feature snapshot storage

### Historical-learning loop
1. Persist every model prediction before the event
2. Store offered odds and later closing odds
3. Attach the actual outcome after settlement
4. Rebuild rolling player/team features
5. Run walk-forward backtests chronologically
6. Score each model by calibration, log loss, CLV, ROI, and drawdown
7. Re-weight the Model Council by sport and market
8. Only promote weight changes after adequate sample size

This is deliberately chronological rather than fitting on the same games being evaluated.

### V9 API
- `POST /api/backtest`
- `POST /api/model-weights`
- `POST /api/features/rolling`
- `POST /api/history/predictions`
- `GET /api/history/model-weights?sport=...&market=...`
- `POST /api/history/rolling-features`

### Database migrations
Apply in order:

```
db/schema.sql
db/v6.sql
db/v7.sql
db/v8.sql
db/v9.sql
```

## Guardrails
- Sportsbook odds are prices, not predictions.
- Backtests use chronological train/test splits to reduce look-ahead bias.
- Small samples do not receive aggressive model weights.
- The 30% daily gain figure remains a dashboard target, not a guaranteed outcome.
- Kelly exposure stays constrained.
- Edgeforce can return **NO BET**.
- Production feeds should be licensed or otherwise authorized.
