# Edgeforce AI

Production-hardened sports prediction, simulation, market-intelligence, CLV, repricing, bankroll and model-learning workspace.

## Current build — V36 Sport-Specific Micro-Simulation Engines

V36 adds granular game-state simulation ahead of the generic team-score layer. Supported full-game markets now simulate the natural unit of play instead of sampling only final scores.

### V36 granular engines
- MLB — plate appearances with outs, walks, singles, doubles, triples, home runs, base advancement, starter and bullpen context
- NFL / NCAAF — drive-level scoring with touchdown, field-goal, safety, tempo, quarterback, trenches and weather context
- NBA / WNBA / NCAAB — possession-level scoring with pace and shooting context
- NHL — shift-level goal generation with goalie, shot-quality, special-teams and pace context
- Soccer — chance-level goal generation with xG, keeper, tactical and set-piece context
- Tennis — point → game → set → match simulation using serve, return and surface context
- Table Tennis — point → game → match simulation using serve and return context

### Routing and safeguards
- player props continue through the V34 distribution-aware prop engine
- supported full-game team/match markets use the V36 micro engine
- period, quarter, half, inning, and set-specific markets fall back unless a dedicated granular model exists
- unsupported sports continue through existing team-score, set-match, combat, or probability-state engines
- 100,000-tier granular simulations are capped internally at 10,000 micro runs for bounded latency
- the scanner records the actual run count executed, not the requested tier
- dashboard audit output includes average micro units per simulation

### APIs and verification
- `GET /api/intelligence/micro-simulation` — granular engine catalog
- `GET /api/testing/micro-simulation` — seven-engine coverage test when test endpoints are enabled
- model-run feature snapshots retain `simEngine`, `microUnit`, and `microUnitCount`

### Release identity
- build: `V36`
- app: `36.0.0`
- package: `0.36.0`
- model: `edgeforce-v36`
- migration: `v35`

### Guardrails
- micro engines are modeling approximations, not literal reconstructions of future games
- missing sport context falls back to conservative defaults rather than fabricated player/team data
- player-prop markets are not forced through team-level possession/drive/shift models
- unsupported market periods fall back rather than being misrepresented as full-game simulations
- simulation probabilities and ranges are estimates, not guarantees

# Edgeforce AI

Production-hardened sports prediction, simulation, market-intelligence, CLV, repricing, bankroll and model-learning workspace.

## Current build — V35 Event-Level Joint Simulation + Learned SGP Correlation

V35 stops treating same-event parlay legs as independent outcomes. It combines a shared event-level Gaussian-copula simulation with conservative historical correlation learning from settled same-event wager legs.

### V35 joint simulation
- 10,000 correlated simulations for standard 2–3 leg parlays
- tapered simulation counts for larger 4–20 leg probability sets to control browser/runtime cost
- one joint probability for the entire parlay
- independent probability retained for direct comparison
- 95% Monte Carlo interval retained
- same-event pair correlation matrix with automatic positive-definite shrinkage
- cross-event legs remain independent inside the joint engine
- same event name on different start times is not treated as the same game

### Learned SGP correlation
- settled same-event leg pairs feed market-pair profiles
- Over/Under direction is preserved in the learned market signature
- phi correlation, joint lift, sample size and confidence are persisted
- minimum sample default: 20 settled pairs
- shrinkage default: 50 samples
- small samples remain neutral
- learned rho is capped to avoid unstable historical overfitting
- heuristic and learned correlation are blended by historical confidence
- active profiles rebuild with the daily recalibration workflow

### APIs
- `GET /api/intelligence/sgp-correlation` — active learned profiles
- `POST /api/intelligence/sgp-correlation` — correlated joint simulation for supplied legs
- `PUT /api/intelligence/sgp-correlation` — authenticated correlation-profile rebuild
- `GET /api/testing/joint-simulation` — deterministic positive/negative correlation guardrail when test endpoints are enabled

### Release identity
- build: `V35`
- app: `35.0.0`
- package: `0.35.0`
- model: `edgeforce-v35`
- migration: `v34`

### Guardrails
- Learned SGP relationships require minimum settled sample size before affecting probability.
- Correlation profiles are shrinkage-weighted and capped.
- Non-positive-definite correlation matrices are automatically shrunk toward independence.
- Public joint-simulation requests are capped at 10,000 runs; authenticated requests can use up to 100,000.
- Same-game correlation and simulation probabilities are estimates, not guarantees.

## V34 Distribution-Aware Prediction Intelligence

V34 upgrades the simulation layer from mostly generic normal-style outputs to market-specific probability distributions with explicit uncertainty ranges.

### V34 distribution families
- Bernoulli for binary event markets when represented as probability outcomes
- Poisson for ordinary count statistics
- negative binomial for overdispersed count statistics
- gamma for positive-skew yardage and similar continuous props
- lognormal for strictly positive skewed duration/distance-type statistics
- normal for high-volume continuous statistics

### Team simulation upgrades
- MLB, NHL and soccer now use discrete score simulation rather than continuous score draws
- higher-scoring team sports retain continuous score models
- team simulation now returns p10, p50 and p90 outcome ranges

### Player prop upgrades
- provider projection mean and standard deviation determine the market distribution when available
- distribution selection is market/stat aware
- p10, p50 and p90 simulated ranges are retained
- distribution confidence is retained separately from model confidence
- availability and non-starter adjustments remain active

### Auditability
- each model run can retain distribution family
- distribution confidence
- p10 / p50 / p90 quantiles
- simulation engine and projection
- player context and sport context

### Release identity
- build: `V34.1`
- app: `34.1.0`
- package: `0.34.1`
- model: `edgeforce-v34`
- migration: `v33`

### Elite roadmap remaining after V36
- V37: multi-provider consensus pricing and sharp-vs-public market structure
- V38: regime detection, uncertainty calibration and dynamic confidence
- V39: portfolio optimization with scenario stress testing and drawdown control
- V40: explainability, model diagnostics, ablation and live what-if analysis
- V41: final data-quality, automation, deployment, security and production hardening

### Guardrails
- Distribution choice is a modeling assumption and is labeled in output.
- Missing projection inputs are not fabricated.
- Simulated ranges and probabilities are estimates, not guarantees.
- Market movement, CLV and historical performance do not guarantee future results.


