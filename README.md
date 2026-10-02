# Edgeforce AI

Cross-market sports probability, simulation, parlay and bankroll intelligence workspace.

## Current build — V29 Historical Calibration + Model Optimization

V29 closes the learning loop between model forecasts and settled outcomes. Each Model Council vote can be persisted with a model run, matching results feed those forecasts into historical prediction data, and the scheduled recalibration engine performs controlled walk-forward validation before any learned weight is promoted.

### V29 learning pipeline
- persists individual Model Council vote probabilities with scheduled model runs
- matching settled results create deduplicated historical prediction records
- supports both manual/API result ingestion and scheduled results-provider settlement
- calculates calibration buckets, Brier score, log loss, ROI and closing-line value
- runs holdout checks and walk-forward backtests by model × sport × market
- keeps insufficient samples at a neutral 1.00 multiplier
- blocks promotion when recent holdout or walk-forward quality is poor
- shrinks learned adjustments toward neutral until sample size grows
- caps automatic learned-weight adjustment to a configurable range
- stores versioned recalibration runs, calibration profiles, model rankings and weight snapshots
- live Model Council prefers only promoted calibrated snapshots
- falls back to legacy bootstrap learning until the first qualified V29 snapshots exist

### Default calibration controls
- `CALIBRATION_MIN_SAMPLE=50`
- `CALIBRATION_MIN_HOLDOUT=20`
- `CALIBRATION_SHRINKAGE_SAMPLES=100`
- `CALIBRATION_MAX_WEIGHT_ADJUSTMENT=0.25`
- `CALIBRATION_LOOKBACK_ROWS=20000`
- `CALIBRATION_WALK_FORWARD_TRAIN=100`
- `CALIBRATION_WALK_FORWARD_TEST=25`

### Validation behavior
A model group must have enough total and holdout samples before it can change its weight. It is held at 1.00 when:
- the total sample is below the configured minimum
- the holdout sample is too small
- holdout Brier score exceeds 0.320
- holdout log loss exceeds 0.850
- walk-forward Brier score exceeds 0.320

Qualified weights are shrinkage-adjusted and capped before they enter the Model Council.

### APIs
- `GET /api/intelligence/calibration` — latest recalibration run, promoted weights and rolling model metrics
- `GET /api/intelligence/backtest` — filtered historical summary and walk-forward folds
- `GET /api/intelligence/learned-weights`
- `POST /api/history/predictions`
- `GET /api/cron/recalibrate`
- `POST /api/results/ingest`

### Existing intelligence retained
- V28 provider resilience, quality gates and circuit breaker
- V27 automated settlement and bankroll ledger
- V26 cross-market sportsbook/prediction-market consensus
- sport-specific Monte Carlo and Model Council
- player/lineup context and SGP correlation
- bankroll and portfolio risk controls

### Guardrails
- No weight change is allowed from a small sample.
- Poor out-of-sample performance blocks weight promotion.
- Learned multipliers are shrunk toward 1.00 and capped.
- Duplicate settled predictions are ignored by source key.
- Pushes do not train win/loss calibration.
- Missing model-run matches are skipped rather than guessed.
- Historical performance and simulations do not guarantee future outcomes.
