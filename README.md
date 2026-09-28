# Edgeforce AI

EV-first sports probability intelligence platform.

## Current build — V6
V6 adds persistent-learning and repricing infrastructure on top of the V5 scanner:
- Scheduled hourly scan hook
- Scheduled daily recalibration hook
- Odds / weather / injury ingestion endpoints
- Injury, weather, home/away, and line-movement repricing logic
- Settlement and CLV calculation
- Calibration metrics: Brier score, log loss, expected calibration error
- Learning endpoint that proposes probability adjustment only after enough samples
- V6 database migration for ingestion runs, model weights, player features, simulation intervals, and repricing context
- Existing 8-day scanner, Today/Week Top 30, AM/PM cards, adaptive 100–100,000 simulations, and correlation-aware parlays remain intact

## Guardrails
- Sportsbook odds are treated as prices, not predictions.
- Positive EV, calibration, uncertainty, and closing-line value matter more than raw hit rate.
- The 30% daily gain is a dashboard target, not a guaranteed return or forced objective.
- Kelly remains constrained.
- The engine may return **NO BET**.
- Live production feeds must be licensed/authorized.
- API keys, cron secrets, and ingest secrets belong only in environment variables.

## Run
```bash
npm install
npm run dev
```

## Core API
- `GET /api/health`
- `GET /api/markets`
- `POST /api/model/run`
- `GET /api/scan?view=today|week`
- `GET /api/parlays?size=2|3`
- `GET /api/players`
- `GET /api/line-history?marketId=...`

## V6 API
- `POST /api/ingest/odds`
- `POST /api/ingest/weather`
- `POST /api/ingest/injuries`
- `POST /api/reprice`
- `POST /api/settle`
- `POST /api/calibration`
- `POST /api/learn`
- `GET /api/cron/scan`
- `GET /api/cron/recalibrate`

Apply `db/schema.sql` first, then `db/v6.sql`.
