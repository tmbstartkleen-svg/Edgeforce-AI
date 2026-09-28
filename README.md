# Edgeforce AI

EV-first sports probability intelligence platform.

## Current build — V7
V7 makes Edgeforce database-backed when `DATABASE_URL` is configured.

### Added in V7
- PostgreSQL client and health check
- Persistent event and market snapshots
- Persisted DraftKings-style odds history
- Stored line-movement retrieval and velocity analysis
- Database-backed Today/Week Top 30 endpoint
- Model-run persistence for ranked opportunities
- Player profile, game-history, and feature retrieval
- Result ingestion and settlement storage
- Closing-line table
- Ranking snapshot table
- Settlement-job tracking
- V7 indexes for latest-line, player-history, and result lookup
- Automatic fallback to demo data when no database is configured

### Data flow
1. Authorized odds provider -> `POST /api/ingest/odds`
2. Market snapshots -> PostgreSQL
3. `GET /api/scan/stored?view=today|week`
4. Model Council + adaptive simulations + EV/Kelly ranking
5. Ranked model runs saved for audit
6. Result feed -> `POST /api/results/ingest`
7. CLV/calibration/retraining layers consume settled history

## Guardrails
- Sportsbook odds are prices, not predictions.
- 30% daily gain is a target display, never a guaranteed or forced objective.
- Kelly remains constrained.
- The engine may return **NO BET**.
- Use licensed/authorized production feeds only.
- Never commit API keys, database credentials, or secrets.

## Run
```bash
npm install
npm run dev
```

## Database
Apply migrations in order:

```
db/schema.sql
db/v6.sql
db/v7.sql
```

Set `DATABASE_URL` in the environment.

## V7 endpoints
- `GET /api/db/health`
- `GET /api/scan/stored?view=today|week`
- `GET /api/line-history/stored?eventId=...&marketKey=...&selectionKey=...`
- `GET /api/player/[id]`
- `POST /api/results/ingest`

Existing V6 ingestion, repricing, calibration, learning, scanner, parlay, and cron endpoints remain available.
