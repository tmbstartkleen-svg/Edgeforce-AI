# Edgeforce AI

Adaptive sports probability intelligence workspace.

## Current build — V22 Adaptive Model Learning

V22 closes the loop between settled historical predictions and the live model council while reducing dependence on near-duplicate probability signals.

### V22 modeling
- bounded learned model-weight multipliers from settled historical predictions
- sport / market-specific weighting with sample-size protection
- calibration, recency-decay, CLV, and performance influence on weight multipliers
- model multipliers capped so one model cannot dominate from a small sample
- more distinct power, matchup, player, environment, line-regime, historical, market, sport-engine, and Bayesian signals
- scenario-volatility simulation that varies event probability using confidence and available injury, weather, travel, starter, goalie, and quarterback context
- past events excluded from current scans
- live / stored / demo source labeling remains explicit
- portfolio optimizer consumes the same learned-weight market ranking used by the live board

### Live board and risk controls
- Top 30 / Top 50 today and 7-day boards
- AM / PM, sport, market, odds, and simulation filters
- 2 through 20 leg probability sets
- bankroll and drawdown controls
- event, sport, and correlation exposure limits
- HOLD / REDUCE portfolio guidance
- prediction-market comparison
- uploaded result-history analytics
- anomaly signals

### APIs
- `GET /api/live-board?view=today&limit=30&risk=Moderate`
- `GET /api/intelligence/learned-weights`
- `GET /api/intelligence/model-performance`
- `POST /api/portfolio/optimize`
- `POST /api/cashout`
- `POST /api/hedge`
- `GET /api/health`

### Live data
The app is provider-driven and does not scrape DraftKings directly. Configure an authorized provider using the ODDS_PROVIDER_* environment variables. Prediction-market providers use PREDICTION_PROVIDER_* variables. When no provider is configured, the UI identifies demo fallback data rather than presenting it as live.

### Database
Apply migrations through `db/v22.sql`. V22 adds learned-model-weight snapshot storage. Learned weights are currently calculated from `historical_predictions`; the snapshot table is available for retained audit/history.

### Guardrails
- Model and simulation probabilities are estimates, not guarantees.
- Historical weighting requires sufficient settled samples; small groups are ignored.
- Learned multipliers are deliberately capped.
- Scenario simulation models uncertainty around the current probability; it is not a full play-by-play physics simulation.
- Correlated exposures are capped by the portfolio layer.
- Sportsbook and prediction-market prices can move quickly.
