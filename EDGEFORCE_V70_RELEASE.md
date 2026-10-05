# Edgeforce V70 — Cross-Sport Auto-Calibration & Simulation Weight Optimizer

V70 learns the final probability blend rather than using one fixed weighting philosophy across every sport and market.

## Optimized inputs
- Model Council ensemble probability
- Native Monte Carlo / sport simulation probability
- Market / consensus probability

## Training discipline
- Chronological 75/25 training and holdout split
- Brier-first objective with log-loss and calibration penalties
- Hard bounds on market and council influence
- Hierarchical GLOBAL → SPORT → SPORT_MARKET priors
- Sparse exact groups shrink toward sport/global parents
- Promotion requires holdout Brier improvement and stable holdout log loss
- Non-promoted profiles preserve the existing simulation-first runtime

## Runtime
Promoted profiles are selected exact-first, then sport-wide, then global. Existing dynamic confidence, regime detection, calibration shrinkage and consensus safeguards remain active after the optimized blend.
