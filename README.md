# Edgeforce AI

Player-aware sports probability and outcome simulation workspace.

## Current build — V25 Player + SGP Correlation Intelligence

V25 adds player-level context and shared same-game correlation modeling on top of V24 sport-specific outcome Monte Carlo.

### V25 player intelligence
- provider player projection mean and standard deviation remain in real stat units
- player status and starting designation are retained separately from normalized sport features
- availability probability can scale a player projection
- confirmed non-starters receive a conservative projection reduction
- player context is matched to the market selection before it can affect a prop
- player context is persisted in model-run audit snapshots

### Same-game correlation
The same correlation engine is now shared by:
- parlay / probability-set calculations
- portfolio correlation exposure

It considers:
- same event
- same player
- same team
- over / under direction
- player prop vs team market interaction
- spread / moneyline relationship
- same-sport background dependence

Correlation-adjusted parlay probability is explicitly separated from the independent-leg product.

### V24 simulation engines retained
- team-score Monte Carlo
- set / match Monte Carlo
- combat outcome Monte Carlo
- player-stat Monte Carlo
- labeled probability-state fallback

### APIs
- `GET /api/live-board`
- `GET /api/intelligence/simulation-engines`
- `GET /api/intelligence/learned-weights`
- `POST /api/intelligence/sgp-correlation`
- `POST /api/portfolio/optimize`
- `GET /api/health`

### Database
Apply migrations through `db/v25.sql`.

### Guardrails
- Player projections are used only when a provider supplies a matching player identity and projection.
- Missing player data is not invented.
- Same-game correlation is an approximation used for model risk control; it is not a sportsbook pricing feed.
- Simulation and parlay probabilities remain estimates, not guarantees.
