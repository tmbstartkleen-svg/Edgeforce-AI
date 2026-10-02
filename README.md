# Edgeforce AI

Sport-specific probability and outcome simulation workspace.

## Current build — V24 Sport Outcome Monte Carlo

V24 moves beyond generic probability-state simulation. Supported sports now simulate event outcomes in the natural scoring unit of the sport before converting those outcomes back into market probabilities.

### V24 simulation engines
- TEAM_SCORE_MONTE_CARLO
  - MLB runs
  - NFL / NCAAF points
  - NBA / WNBA / NCAAB points
  - NHL goals
  - soccer goals
  - rugby points
  - lacrosse goals
  - cricket runs
  - produces home mean, away mean, total mean, and margin mean
- SET_MATCH_MONTE_CARLO
  - tennis
  - table tennis
  - volleyball
  - simulates set-by-set match outcomes and total sets
- COMBAT_OUTCOME_MONTE_CARLO
  - UFC / MMA
  - boxing
  - simulates selected-side win, finish state, and round distribution
- PLAYER_STAT_MONTE_CARLO
  - activates when a provider supplies a player projection mean and optional standard deviation
  - evaluates over / under props from a simulated stat distribution
- PROBABILITY_STATE_FALLBACK
  - remains available when the market or provider context is insufficient for a richer outcome model

### V24 data inputs
The simulator consumes the V23 provider context layer and V22 learned model weights:
- weather
- injuries
- starters
- goalies
- quarterbacks
- rest and travel
- sport-specific efficiency/form features
- historical model calibration and CLV weighting

### Auditability
Every scanned row now contains:
- `simEngine`
- `simProjection`
- simulation run count
- probability and confidence interval

Model-run feature snapshots retain the engine and projection, and V24 adds database indexes for querying simulation engine history.

### APIs
- `GET /api/live-board?view=today&limit=30&risk=Moderate`
- `GET /api/intelligence/simulation-engines`
- `GET /api/intelligence/learned-weights`
- `POST /api/portfolio/optimize`
- `GET /api/health`

### Guardrails
- Simulations are model estimates, not guaranteed outcomes.
- A sport-specific engine is used only where Edgeforce has enough structure to model the outcome honestly.
- Unsupported markets stay on the labeled probability-state fallback rather than pretending to have score-level detail.
- Player-stat Monte Carlo requires provider projection inputs; missing player projections are not invented.
- Context and historical weighting remain bounded.
