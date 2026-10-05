# Edgeforce V64 — Opponent & Matchup Learning Engine

V64 learns opponent tendencies directly from the player game-history warehouse and turns them into bounded, confidence-weighted simulation features.

## Added
- Opponent profiles by sport, position and stat
- Team-level fallback profiles when position samples are thin
- League-relative allowed-stat signals
- Matchup volatility and confidence
- 730-day rolling history window
- Daily matchup profile rebuild
- Runtime matchup enrichment before simulation
- Matchup intelligence API, regression endpoint and dashboard panel

## Runtime path
Player game history → opponent profiles → player/opponent join → directional matchup signal → Monte Carlo simulation.

V64 supplements the model council, V62 player frames and V63 player calibration rather than replacing them.
