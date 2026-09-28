# Edgeforce AI

EV-first sports probability intelligence platform.

## Current build — V5
V5 adds the operational scan layer on top of the V4 Model Council:
- 8-day market horizon
- Today Top 30 and Week Top 30
- AM/PM cards
- Adaptive deterministic simulation tiers: 100 / 1,000 / 10,000 / 100,000
- 95% simulation confidence intervals
- Market freshness grading
- Correlation-aware 2-leg and 3-leg parlay construction
- Player-profile API
- Line-history API
- Provider-ready scan API
- Fair odds, EV, model agreement and fractional Kelly remain core ranking inputs

## Principles
- Sportsbook odds are a price, not a prediction.
- Positive EV and calibration matter more than raw hit rate.
- Kelly is constrained; the 30% daily gain target never forces wagers.
- The system may return **NO BET**.
- Live production feeds must be licensed/authorized and keys must stay in environment variables.

## Run
```bash
npm install
npm run dev
```

## API
- `GET /api/health`
- `GET /api/markets`
- `POST /api/model/run`
- `GET /api/scan?view=today|week`
- `GET /api/parlays?size=2|3`
- `GET /api/players`
- `GET /api/line-history?marketId=...`
