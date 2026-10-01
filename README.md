# Edgeforce AI

Live sports probability intelligence workspace.

## Current build — V21 Live Board + History Intelligence

V21 turns the project into a daily-use dashboard instead of a spreadsheet.

### V21 workspace
- today board with Top 30 or Top 50 legs
- AM / PM filtering
- sport and market filters
- American-odds range filter
- simulation probability filter
- 7-day board that distributes rows across the week
- 2 through 20 leg probability-set selector
- cross-sport set view
- simulation vs market-implied probability comparison
- anomaly signal panel
- generic prediction-market provider adapter
- screenshot-derived result history
- observed performance by sport, leg count, and known market type
- athlete / player-stat / market-snapshot / model-run database counters
- 1-second UI refresh with a short upstream source cache

### Live data
The dashboard is provider-driven. It does not scrape DraftKings directly.

Configure an authorized odds provider that returns DraftKings markets through:
- `ODDS_PROVIDER_PRIMARY_URL`
- `ODDS_PROVIDER_PRIMARY_KEY`

Additional failover providers are already supported.

Prediction-market data uses:
- `PREDICTION_PROVIDER_PRIMARY_URL`
- `PREDICTION_PROVIDER_PRIMARY_KEY`

If providers are not configured, the dashboard explicitly shows DEMO FALLBACK rather than presenting sample data as live.

### Core APIs
- `GET /api/live-board?view=today&limit=30&risk=Moderate`
- `GET /api/live-board?view=week&limit=50&risk=Moderate`
- `GET /api/db/stats`
- `GET /api/health`
- `POST /api/cashout`

### Database
Apply migrations through:
```
db/v21.sql
```

V21 adds tables for parsed bet slips, bet legs, prediction-market snapshots, and anomaly signals. Existing athlete, event, player-stat, market-snapshot, model-run, result, calibration, provider, release, and monitoring tables remain intact.

### Result-history rules
Uploaded screenshots are used only when information is clearly visible. Hidden losing legs are stored as unknown rather than guessed. Historical hit rates are descriptive and sample-size dependent; they are not guarantees of future outcomes.

### Release
The repository includes:
- build verification
- migration checks
- smoke tests
- concurrency checks
- preview deployment workflow
- hosted smoke tests
- production promotion
- rollback workflow

## Guardrails
- Simulation percentages are model outputs, not certainties.
- Correlated legs reduce combined probability.
- Small historical samples can look much stronger or weaker than they really are.
- Prediction-market and sportsbook prices can move quickly.
