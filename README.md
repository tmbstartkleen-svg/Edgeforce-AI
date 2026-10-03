# Edgeforce AI

Production-hardened sports prediction, simulation, market-intelligence, CLV, repricing, bankroll and model-learning workspace.


## Current build — V45 Real Data Autopilot

V45 makes the production path real-data-only and turns Cloudflare into the live ingestion scheduler instead of relying on demo fallbacks.

### Live sportsbook connection
- `THE_ODDS_API_KEY` drives the native The Odds API feed for DraftKings-targeted moneylines, spreads and totals
- `GET /api/live-data/status` reports the actual provider source, market count, sports, target book, quality and provider attempts without exposing credentials
- `GET /api/live-data/status?requireLive=1` fails unless the active source is live, so deployment certification cannot pass on demo or stale-only data
- production ingestion returns an explicit `unavailable` state instead of substituting demo markets
- the public `/api/scan` route and decision automation now use the same real ingestion path as the live board

### Cloudflare real-data autopilot
- the Worker has a custom vinext entry point with Cloudflare `scheduled()` support
- hourly automation refreshes real sportsbook data, persists model runs, executes decision automation, settlement and readiness heartbeat
- a daily automation run performs model recalibration/governance plus provider certification
- the selected Cloudflare account is pinned in Wrangler configuration to remove multi-account deployment ambiguity
- production Worker config sets `ALLOW_DEMO_DATA=false`

### Private one-command secret setup
Run `npm run configure:cloudflare-live` locally. Wrangler prompts privately for `THE_ODDS_API_KEY` and `DATABASE_URL`, then creates encrypted ingest and cron secrets without printing them. Secrets are not committed to Git.

### Release identity
- build: `V45`
- app: `45.0.0`
- package: `0.45.0`
- model: `edgeforce-v45`
- migration: `v38`

### Guardrails
- strict production certification requires a live odds source and at least one market
- demo data remains available only for non-production development/testing unless explicitly enabled
- live odds, model probabilities and simulations are estimates and can change; they are not guaranteed outcomes


## Current build — V44 Cloudflare Launch Guardrails + Runtime Identity

V44 hardens the Cloudflare production path so deployment failures are caught before upload and Cloudflare is treated as a first-class production runtime rather than a Vercel-shaped fallback.

### Cloudflare deployment guardrails
- `npm run preflight:cloudflare` rejects literal placeholder values such as `PASTE_YOUR_ACCOUNT_ID_HERE` before Wrangler can call the wrong account path
- local OAuth sessions remain supported when Cloudflare token/account environment variables are intentionally unset
- `npm run validate:cloudflare-build` verifies that vinext generated `dist/server/wrangler.json` and that its Worker entry point actually exists
- `npm run deploy:cloudflare` now runs preflight → vinext build → generated-config validation → deployment in one guarded command
- the GitHub Cloudflare workflow uses the same preflight and generated-build validation path

### Cloudflare production runtime identity
- Worker builds now set `DEPLOYMENT_PLATFORM=cloudflare` and `DEPLOYMENT_ENV=production`
- readiness uses platform-neutral deployment identity instead of assuming every production runtime is Vercel
- Cloudflare production therefore enables strict readiness automatically
- deployment smoke output identifies the runtime platform and environment without exposing secrets

### Release identity
- build: `V44`
- app: `44.0.0`
- package: `0.44.0`
- model: `edgeforce-v44`
- migration: `v38`

### Guardrails
- deployment preflight validates configuration shape and placeholder values; it does not validate secret contents
- Cloudflare production still requires the real database and sportsbook credentials to pass strict readiness
- model probabilities and simulations remain estimates, not guaranteed outcomes

## Current build — V43 Real Sports Data + Automated Runtime Bootstrap

V43 removes the remaining demo-first production dependency and gives Edgeforce a native live sportsbook path.

### Real sportsbook data
- native The Odds API integration using one secret: `THE_ODDS_API_KEY`
- automatically discovers all currently active sports
- uses free event discovery to find sports with games inside the next eight days before spending odds credits
- requests DraftKings plus FanDuel, BetMGM and Caesars/William Hill U.S. prices for moneylines, spreads and totals
- preserves DraftKings as the target wager price while using the additional books for consensus pricing
- dynamically includes tennis, soccer, football, basketball, baseball, hockey, MMA and any other active supported sport returned by the provider
- caches live odds requests and preserves a configurable credit reserve to avoid accidental quota exhaustion
- stores accepted live market snapshots and consensus quotes in Postgres through the existing ingestion path

### Real prediction-market data
- public Polymarket market probabilities are used as a credential-free prediction-market fallback
- a configured dedicated prediction-market provider still takes priority when present
- unmatched or illiquid prediction markets remain labeled rather than fabricated

### Automated Vercel runtime bootstrap
- Edgeforce accepts Neon-created `POSTGRES_URL`, `POSTGRES_PRISMA_URL` or `NEON_DATABASE_URL` automatically; a manual `DATABASE_URL` alias is no longer required
- database migrations run inside the deployed Vercel runtime so encrypted Neon credentials never need to be exported into GitHub Actions
- deployment-only ingest, cron and bootstrap secrets are generated automatically by GitHub Actions
- the production workflow applies migration v38, certifies the live odds provider, runs strict launch readiness, hosted smoke tests and final release certification
- only the external sportsbook API account/key must be supplied by the operator

### Release identity
- build: `V43`
- app: `43.0.0`
- package: `0.43.0`
- model: `edgeforce-v43`
- migration: `v38`

### Guardrails
- Edgeforce never labels demo/stored fallback rows as live provider data
- a live ODDS provider must certify successfully before strict production certification passes
- The Odds API usage quota is monitored from response headers and refreshes stop at the configured reserve
- sportsbook availability is provider coverage, not a guarantee that a wager is legally available in every U.S. jurisdiction
- model probabilities and simulations remain estimates, not guaranteed outcomes

## Current build — V42 Champion/Challenger Governance + Drift Control

V42 adds a production model-governance layer above calibration. Historical strength alone can no longer preserve full model influence when recent probability distributions or recent performance deteriorate.

### V42 champion/challenger governance
- evaluates every model × sport × market group on a baseline window and a recent holdout window
- assigns `CHAMPION`, `CHALLENGER`, `MONITORED`, or `HELD` roles
- retains the existing champion unless a qualified challenger clears the configured promotion margin
- excludes critically drifting models from champion/challenger eligibility
- persists every governance decision and its reason for auditability

### V42 drift detection
- computes probability-distribution Population Stability Index (PSI)
- compares recent vs baseline Brier score, log loss, calibration error, average CLV, and mean predicted probability
- classifies each model group as `HEALTHY`, `WATCH`, `DRIFTING`, `CRITICAL`, or `INSUFFICIENT`
- separates distribution shift from outcome-quality deterioration so either can trigger a brake

### Runtime safety
- governance multipliers are applied inside the existing learned-weight path used by the model council
- WATCH, DRIFTING, and CRITICAL states progressively reduce model influence
- critical models are held at a severe runtime brake instead of being trusted because of older historical results
- scheduled recalibration rebuilds governance automatically, so scan and decision automation inherit the same controls

### V42 APIs and validation
- `GET /api/intelligence/model-governance` — current roles, drift metrics, multipliers, and latest governance run
- `GET /api/testing/model-governance` — deterministic champion/challenger + critical-drift regression test
- dashboard shows current champions, drift-watch models, PSI, and runtime multipliers
- migration `v38` stores governance runs and snapshots

### Release identity
- build: `V42`
- app: `42.0.0`
- package: `0.42.0`
- model: `edgeforce-v42`
- migration: `v38`

### Guardrails
- champion status means best qualified model under the configured historical tests; it is not a guarantee of future accuracy
- PSI detects distribution shift but does not identify the cause of the shift
- governance brakes reduce model influence; they do not eliminate market, data, or model risk
- model probabilities and simulations remain estimates, not guaranteed outcomes

## Current build — V41 Production Certification + Final Hardening

V41 completes the planned Edgeforce roadmap with release-wide certification rather than another prediction layer. It verifies the data contract, scheduled automation, security posture, release identity, migration state, provider certification, and post-deploy production health as one system.

### V41 data integrity
- batch market contract auditing validates required identifiers, timestamps, American odds, probability bounds, confidence, source age, duplicates, consensus depth, target-book coverage, and context-feature coverage
- batch audits return a quality score, TRUSTED / USABLE / CAUTION / REJECT grade, blockers, warnings, and row-level issues
- scheduled scans include the same batch audit used by the live data-quality endpoint
- malformed, duplicated, and stale market rows are covered by deterministic regression tests

### V41 automation health
- heartbeat, settlement, scan, decision, and recalibration jobs persist durable run status, duration, release version, metadata, and failures
- automation health classifies every scheduled job as HEALTHY, STALE, FAILED, or PENDING
- stale or failed jobs block strict production certification; never-run jobs are visible warnings until the schedule has executed
- scheduled scan and decision jobs use the same learned weights and dynamic calibration profiles as the live scoring path

### V41 security hardening
- separate read and mutation rate limits
- 1 MB declared mutation-body ceiling
- TRACE / TRACK / CONNECT rejection
- request IDs on normal and security-failure responses
- no-store policy on API responses
- HSTS, CSP, anti-framing, MIME sniffing, permissions, referrer, COOP/CORP, and cross-domain policy headers
- static release audit checks for accidentally tracked environment-secret files

### V41 release certification
- `npm run release-audit` rejects release/version drift, missing migration files, missing hardening endpoints, cron drift, weakened security constants, workflow identity drift, and nonblank example secrets
- migration `v37` adds durable automation and production-certification history
- `POST /api/release/certify?strict=1` combines readiness, provider certification, live data quality, automation health, security posture, release attestation, and operational incidents
- production deployment runs final certification after hosted smoke + attestation
- a failed final certification flows into the existing automatic rollback path

### V41 APIs
- `GET /api/data-quality` — current live/stored/demo batch audit
- `GET /api/automation/health` — durable scheduler health
- `GET /api/release/certify` — latest production certification
- `POST /api/release/certify?strict=1` — authorized strict post-deploy certification
- deterministic tests: `/api/testing/data-contract`, `/api/testing/automation-health`, and `/api/testing/security-hardening`

### Release identity
- build: `V41`
- app: `41.0.0`
- package: `0.41.0`
- model: `edgeforce-v41`
- migration: `v37`

### Roadmap status
The original V34–V41 elite roadmap is complete. V42 extends it with measured model-governance controls driven by settled prediction history, calibration behavior, and production drift rather than feature count.

### Guardrails
- production certification is an operational gate, not a guarantee of model accuracy or profit
- body-size enforcement at the edge rejects oversized declared mutation requests; infrastructure-level request limits remain part of deployment security
- automation health depends on durable database records after scheduled jobs begin running
- live provider quality, simulations, and model probabilities remain estimates and can fail or change

## V40 Explainability + Diagnostics + Live What-If

V40 makes Edgeforce probabilities inspectable and scenario-testable instead of treating the ensemble as a black box.

### V40 explainability
- decomposes the ensemble into additive normalized model contributions that reconstruct the council probability
- reports each model's probability, normalized weight, signed contribution, and direction
- runs leave-one-model-out ablation across all council members
- zeroes each active sport/context feature to measure its probability contribution
- perturbs active features to estimate local sensitivity per feature unit
- reports weight concentration, effective model count, dominant model, council agreement, and dispersion
- classifies explanation fragility as `ROBUST`, `MODERATE`, or `FRAGILE`

### V40 diagnostics
- `GET /api/intelligence/explainability` returns market-level explanations
- `GET /api/intelligence/model-diagnostics` summarizes fragility, model concentration, agreement, dominant-model frequency, and largest edges across current markets
- the main dashboard shows aggregate fragility diagnostics
- every board row exposes an `EXPLAIN` action for exact event + market + selection drill-down

### V40 live read-only what-if
- `POST /api/what-if` accepts context changes, feature overrides, feature deltas, and optional probability deltas
- recalculates council explanation, calibrated simulation probability, dynamic confidence, grade, regime, stake sizing, and portfolio result
- returns explicit before/after deltas and fragility changes
- does not write to odds history, wagers, calibration history, or model learning
- drill-down controls allow interactive line-move, home-adjustment, and feature-delta scenarios

### V40 validation
- additive contribution reconstruction is regression-tested to numerical tolerance
- component and feature ablation coverage is required
- scenario movement is required
- smoke testing performs a real read-only what-if POST and requires explanation diagnostics

### Release identity
- build: `V40`
- app: `40.0.0`
- package: `0.40.0`
- model: `edgeforce-v40`
- migration: `v36` (no schema change required)

### Guardrails
- explanations describe model mechanics; they do not prove causality
- local sensitivity is conditional on current inputs and is not a guarantee of outcome
- what-if scenarios are hypothetical and read-only
- model explanations and simulations remain estimates, not guaranteed betting outcomes

## V39 Portfolio Stress Testing + Drawdown Control

V39 upgrades portfolio sizing from static exposure caps to scenario-tested tail-risk control.

### V39 portfolio engine
- runs deterministic Monte Carlo portfolio scenarios across accepted positions
- scenarios: `BASE`, `MODEL_MISS`, `MARKET_DISLOCATION`, `CORRELATED_SLATE`, and `DRAWDOWN`
- models shared slate, sport, event, and idiosyncratic loss factors
- reports mean P/L, p05/p10/p50/p90/p95, volatility, loss probability, and modeled drawdown-breach probability
- computes 95% Value at Risk (VaR) and Conditional Value at Risk (CVaR)
- applies a continuous drawdown brake as current bankroll drawdown grows
- applies a second portfolio-wide CVaR scale when modeled tail loss exceeds the configured limit
- keeps event, sport, position, correlation, and daily-risk caps
- uses V38 dynamic confidence and regime state when scoring and sizing positions

### V39 controls
- `PORTFOLIO_STRESS_RUNS=1500`
- `PORTFOLIO_MAX_CVAR_PCT=0.06`
- `PORTFOLIO_STRESS_DRAWDOWN_PCT=0.10`
- `PORTFOLIO_MIN_DYNAMIC_CONFIDENCE=0.45`

### V39 validation
- `GET /api/testing/portfolio-stress` verifies five scenarios, CVaR output, and drawdown allocation reduction
- the production smoke suite includes portfolio stress regression coverage
- the dashboard exposes worst-scenario VaR/CVaR, loss probability, drawdown breach probability, drawdown brake, CVaR scale, and scenario detail

### Release identity
- build: `V39`
- app: `39.0.0`
- package: `0.39.0`
- model: `edgeforce-v39`
- migration: `v36` (no schema change required)

### Guardrails
- VaR/CVaR and scenario probabilities are model estimates, not guarantees or hard loss bounds.
- stress scaling reduces modeled exposure but cannot eliminate real-world market, execution, or data risk.
- the optimizer rejects insufficient-confidence rows and preserves existing concentration caps.

## V38 Regime-Aware Uncertainty + Dynamic Confidence

V38 turns calibration, market structure, and simulation precision into live decision controls instead of passive diagnostics.

### V38 confidence engine
- classifies market regimes as `STABLE`, `VOLATILE`, `DISLOCATED`, `THIN`, or `UNKNOWN`
- combines source freshness, model agreement, simulation precision, consensus agreement, distribution confidence, and historical calibration reliability
- creates per-row dynamic confidence and uncertainty scores
- shrinks raw simulation probabilities toward historical calibration and cross-book consensus as uncertainty rises
- widens probability intervals in volatile and dislocated regimes
- reduces fractional-Kelly stake sizing when confidence falls
- downgrades ELITE/STRONG grades when confidence is LOW or the regime is DISLOCATED
- exposes live regime coverage and confidence coverage
- persists regime/confidence audit fields inside model-run feature snapshots

### V38 APIs and validation
- `GET /api/intelligence/regime-confidence` — calibration profiles and recent regime decisions
- `GET /api/testing/regime-confidence` — deterministic stable-vs-dislocated regression test
- smoke coverage verifies confidence degrades under dislocated market conditions

### Release identity
- build: `V38`
- app: `38.0.0`
- package: `0.38.0`
- model: `edgeforce-v38`
- migration: `v36` (no schema change required)

## V37 Multi-Provider Consensus Pricing + Market Structure

V37 replaces single-feed market baselines with a robust cross-book pricing panel. Edgeforce keeps the target sportsbook's actual wager odds for EV/Kelly while using a weighted, quality-aware, outlier-resistant consensus probability as the market baseline.

### V37 consensus pricing
- fetches every healthy configured odds provider in parallel
- respects provider circuit breakers and payload-quality gates
- normalizes h2h / moneyline / ML aliases into one canonical market identity
- collapses duplicate books before consensus
- weights prices by configured weight, live provider health and payload quality
- rejects extreme price outliers with robust median/MAD logic
- computes consensus no-vig probability, fair odds, dispersion and agreement
- preserves the target-book price for actual wager EV/Kelly
- surfaces the best available book/price for shopping
- stores provider/book quotes and consensus snapshots in Postgres

### Explicit market-role structure
- provider or individual-book roles may be configured as `SHARP`, `PUBLIC`, `REFERENCE`, or `NEUTRAL`
- sharp/public probability gaps are calculated only from explicitly tagged books
- untagged markets remain `UNCLASSIFIED`
- Edgeforce does **not** infer bettor ticket percentages, handle percentages, or bookmaker sophistication from price alone
- supported structure labels: `SHARP_OVER_PUBLIC`, `PUBLIC_OVER_SHARP`, `ALIGNED`, `MIXED`, `UNCLASSIFIED`

### Configuration
- `TARGET_BOOKMAKER=DraftKings`
- per-provider: `*_MARKET_ROLE` and `*_CONSENSUS_WEIGHT`
- optional aggregator overrides: `ODDS_BOOK_ROLE_MAP` and `ODDS_BOOK_WEIGHT_MAP` as JSON objects
- secondary/tertiary flat feeds keep distinct bookmaker identities unless the payload explicitly names the same book

### APIs and UI
- `GET /api/intelligence/market-consensus` — recent consensus snapshots and coverage
- `GET /api/testing/market-consensus` — deterministic target-book/outlier/role regression test when test endpoints are enabled
- live board shows target price, best price, consensus %, book depth, agreement and market structure
- board ranking/stake confidence incorporates cross-book dispersion and agreement

### Release identity
- build: `V37`
- app: `37.0.0`
- package: `0.37.0`
- model: `edgeforce-v37`
- migration: `v36`

### Guardrails
- target-book odds are never replaced by consensus odds for EV/Kelly calculations
- a one-book market is not presented as deep consensus
- rejected outliers do not inflate post-filter consensus dispersion
- market-role labels are configuration, not inferred facts about bettors
- consensus pricing, simulations and model edges are estimates, not guarantees

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

## V35 Event-Level Joint Simulation + Learned SGP Correlation

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

### Elite roadmap status
- V41 completes the planned final data-quality, automation, deployment, security, and production-hardening milestone.

### Guardrails
- Distribution choice is a modeling assumption and is labeled in output.
- Missing projection inputs are not fabricated.
- Simulated ranges and probabilities are estimates, not guarantees.
- Market movement, CLV and historical performance do not guarantee future results.



