# Edgeforce V64 — Opponent & Matchup Learning Engine

V64 learns opponent tendencies directly from the player game-history warehouse and turns them into bounded, confidence-weighted simulation features that extend the V62/V63 player stack.

## Added
- Baseline-adjusted opponent defense profiles by sport and stat
- Position-specific matchup strength with team-level fallback profiles
- Exact player-vs-opponent learning profiles by stat
- Athlete-diversity and sample-confidence controls
- Direction-aware OVER/UNDER matchup signals
- V64 player-vs-opponent signals replace the overlapping V62 opponent-history term when qualified, preventing double counting
- V63 player calibration remains a separate settled-result correction layer
- Matchup volatility and confidence
- 730-day rolling history window
- Daily opponent and player matchup profile rebuild
- Runtime matchup enrichment before simulation
- Matchup intelligence API, regression endpoint and dashboard observability

## Runtime path
Player game history → player baselines → team/position defense profiles + exact player/opponent profiles → V62 player feature stack → V63 calibration → bounded Monte Carlo adjustment.

V64 supplements the model council, V62 player frames and V63 player calibration rather than replacing their quality, calibration or recommendation gates.
