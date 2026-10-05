# Edgeforce V66 — Starting Lineup & Depth-Chart Intelligence Engine

V66 turns starter status and roster depth into explicit simulation inputs.

## Added
- Historical starter flag ingestion into player game history
- Learned depth-chart profiles by team and position
- Starter-rate, minutes, usage and composite role scores
- Live confirmed starter overrides
- Injury-driven backup promotion probability
- Projection scaling for uncertain starter roles
- Live lineup snapshot persistence
- Daily depth-chart rebuild
- Intelligence API, regression endpoint and dashboard panel

## Runtime path
Historical starts/minutes/usage → depth chart → live injury + confirmed starter context → promotion probability → V65 role redistribution → player/game simulations.
