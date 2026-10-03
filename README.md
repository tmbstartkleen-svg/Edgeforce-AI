# Edgeforce AI

Production-hardened sports prediction, simulation, market-intelligence, CLV, repricing, bankroll and model-learning workspace.

## Current build — V34.1 Provider Certification + Launch Doctor

V34.1 keeps the V34 distribution-aware prediction model unchanged and adds launch-readiness tooling that certifies live provider contracts, scores capability coverage, persists certification history, and produces a single blocker/warning report before production.

### V34.1 launch-readiness upgrades
- authenticated live provider certification for configured feeds
- ODDS treated as a hard launch requirement
- weather, injuries, stats, results and prediction markets scored as enrichment coverage
- freshness, row-count, payload-quality and latency evidence retained per provider
- odds feeds must normalize into valid markets to certify
- certification history persisted in Postgres through migration v33
- `/api/providers/certify` for certification status and authorized live probes
- `/api/launch-doctor` for combined readiness + provider-certification blockers
- synthetic CI guardrails prove failed core odds feeds block launch

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

### Elite roadmap remaining after V34
- V35: event-level joint simulation and learned SGP correlation
- V36: sport-specific possession/play/plate-appearance/shift engines
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
