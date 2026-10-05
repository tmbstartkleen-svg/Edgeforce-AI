# Edgeforce V63 — Player-Level Calibration

V63 closes the player-learning loop by using settled player-prop outcomes to calibrate future simulations.

## Added
- Per-player, per-stat, per-direction calibration profiles
- Bayesian-style shrinkage toward each profile's average model probability
- Minimum 8 settled samples before runtime use
- Confidence scaling up to 40 graded samples
- Calibration correction capped at ±6 percentage points
- Brier score tracking for player profiles
- Daily recalibration integration
- Player calibration API, regression endpoint, and dashboard panel

## Runtime path
Settled player props → player calibration profiles → context fusion → bounded simulation correction.

This layer supplements existing model council, context quality, validation, and risk gates. It does not bypass them.
