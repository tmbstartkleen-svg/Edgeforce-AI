# Edgeforce V153 — Evidence-Weighted Model Learning

V153 turns the V152 settlement learning weight into an active statistical weight across analytics and model training.

## What changed

- Backtests now weight hit rate, Brier score, log loss, ROI, expected value, CLV, and drawdown by settlement evidence quality.
- Backtest output now reports both raw sample size and effective weighted sample size.
- Calibration buckets use evidence-weighted predicted and actual rates.
- Calibration summaries report effective weighted sample size.
- Rolling model performance combines time decay with settlement evidence weight.
- Recalibration shrinkage now uses effective evidence sample size, so lower-confidence evidence produces smaller automatic model-weight changes.
- Internal trained sport models use evidence weight in:
  - feature standardization,
  - logistic gradient updates,
  - Platt-style calibration fitting,
  - holdout Brier/log-loss/accuracy/calibration metrics.
- Internal trained model telemetry reports effective sample sizes for total, train, calibration, and holdout sets.
- External ML tournament payloads now include per-row evidence weights.
- The Python ML service validates and applies evidence weights to estimator fitting, calibration, holdout scoring, and market-baseline comparison.
- PyMC Bayesian logistic training uses a weighted likelihood.
- Adds deterministic runtime and mandatory regression coverage plus health, smoke, and release-audit certification.

## Evidence weighting

The V152 policy remains unchanged:
- provider-native = 1.00
- HIGH corroborated score = 1.00
- MEDIUM corroborated score = 0.75
- trusted primary single-source = settlement-valid but excluded from automatic learning
- legacy pre-V152 history remains eligible with its legacy evidence weight

V153 makes those numeric weights materially affect the model instead of serving as telemetry only.

Cloudflare remains the production primary. Vercel remains a manual-only disaster-recovery standby.
