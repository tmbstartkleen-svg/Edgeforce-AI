# Edgeforce AI

Cross-market sports probability, simulation, parlay and bankroll intelligence workspace.

## Current build — V26 Cross-Market Consensus Intelligence

V26 turns the sportsbook and prediction-market feeds into one auditable probability board instead of displaying them as separate sources.

### V26 probability stack
- preserves the posted American odds and raw implied sportsbook probability
- de-vigs complete 2-way and 3-way sportsbook markets before comparing the model to the book
- matches prediction contracts to sportsbook selections conservatively
- requires a configurable prediction-market volume threshold before using that probability for edge
- marks unmatched, illiquid, and unknown-liquidity prediction data instead of inventing a comparison
- shows sport-engine probability, Monte Carlo probability, sportsbook edge, prediction-market edge, fair price and conservative quarter-Kelly
- caps displayed quarter-Kelly at 5% of bankroll for risk control

### Prediction-market liquidity
Set `PREDICTION_MIN_VOLUME` to the minimum reported contract volume required for a prediction-market probability to be treated as usable. The default is `1000`.

Statuses exposed on each board row:
- `MATCHED`
- `ILLIQUID`
- `UNKNOWN_LIQUIDITY`
- `NO_MATCH`

### Existing V25 intelligence retained
- player projection and availability context
- same-game correlation engine
- sport-specific outcome Monte Carlo
- Model Council ensemble
- historical backtesting and learned model weights
- portfolio risk and bankroll controls
- daily and weekly probability boards
- result-history analytics

### APIs
- `GET /api/live-board`
- `GET /api/intelligence/simulation-engines`
- `GET /api/intelligence/learned-weights`
- `POST /api/intelligence/sgp-correlation`
- `POST /api/portfolio/optimize`
- `GET /api/health`

### Guardrails
- Missing sportsbook, lineup, player, weather, or prediction-market data is not fabricated.
- Prediction-market edge is only calculated for a confidently matched contract above the configured volume threshold.
- De-vig probability is only recomputed when a complete 2-way or 3-way market is present.
- Simulation, edge, Kelly sizing and parlay probabilities are estimates, not guarantees.
