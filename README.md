# Edgeforce AI

Production-hardened sports prediction, simulation, market-intelligence, CLV, repricing, bankroll and model-learning workspace.

## Current build — V59 Champion Drift + Auto-Rollback

V59 closes the production feedback loop for promoted heavyweight external-ML champions. After a champion is promoted, Edgeforce now grades its **live settled predictions** against real outcomes and the contemporaneous market baseline, detects degradation, and can safely remove a failing external champion without disabling the native Edgeforce stack.

### Settled live champion evidence
External ML prediction snapshots now retain:
- champion algorithm and service model ID
- predicted probability and confidence
- sportsbook / market baseline probability
- settlement outcome
- settlement timestamp
- closing odds when available

The normal results-settlement pipeline now settles matching external-ML prediction snapshots at the same time it grades Model Council and player-prop predictions.

### Live drift metrics
For each active external champion V59 measures a configurable recent window using:
- live Brier score
- live log loss
- live calibration error
- live Brier Skill Score versus the market baseline
- Brier degradation versus the champion's original untouched holdout
- a normalized drift score

Default evidence controls:
- minimum settled sample: `30`
- recent window: `100`
- watch Brier Skill: below `0`
- watch Brier degradation: `+0.03`
- watch calibration error: `0.11`
- critical Brier Skill: `-0.08`
- critical Brier degradation: `+0.06`
- critical calibration error: `0.16`

All thresholds are configurable through the V59 ML champion drift environment variables.

### Two-strike quarantine
A single poor evaluation cannot automatically remove a champion.

1. a champion must first reach the minimum settled sample
2. the first critical evaluation records `CRITICAL` but takes no destructive action
3. a second critical evaluation must contain **new settled evidence**
4. only then does V59 request hosted champion retirement
5. the service verifies that the exact model ID is still the active manifest
6. only after hosted retirement succeeds does Edgeforce mark the database champion `QUARANTINED`

Repeated checks against an unchanged sample do not count as an additional strike.

### Service-first rollback
The Python service adds authenticated `POST /retire` using schema `edgeforce-ml-retire-v1`.

Retirement:
- verifies the requested model is still the exact current champion
- archives the champion manifest under persistent `MODEL_STORE_DIR/retired`
- removes the active manifest
- leaves the serialized model artifact intact for audit/research

After retirement, the external expert produces no prediction for that sport/market and Edgeforce automatically continues with the native model stack. A later tournament can re-promote a new evidence-qualified champion and re-open that champion slot.

### Scheduled governance
Daily recalibration now runs the external champion drift monitor **before** the next heavyweight tournament. This serialization prevents the monitor and tournament from mutating the same champion slot concurrently.

The order is:
1. native recalibration / validation / sport-model training
2. external champion drift evaluation and any safe quarantine
3. external ML challenger tournament and possible evidence-backed promotion

### Durable monitoring
Migration `v48` adds:
- settled fields to `external_ml_prediction_snapshots`
- active/quarantine/live-metric fields to `external_ml_champions`
- `ml_champion_monitor_runs`
- `ml_champion_monitor_snapshots`

Every monitor run retains the state, sample size, live metrics, prior critical evidence, action, reason, and drift score.

### APIs and UI
- status: `GET /api/intelligence/ml-drift`
- authenticated run: `POST /api/ml/drift-monitor`
- deterministic regression: `GET /api/testing/ml-champion-drift`
- dashboard: **V59 Champion Drift + Auto-Rollback**
- modeling workspace: `/models`

### Release identity
- build: `V59`
- app: `59.0.0`
- package: `0.59.0`
- model: `edgeforce-v59`
- migration: `v48`
- ML service: `edgeforce-ml-service-v59`

### Guardrails
- insufficient live samples cannot quarantine a champion
- WATCH state never automatically quarantines
- one CRITICAL evaluation never automatically quarantines
- repeated checks without new settled evidence cannot create a second strike
- hosted retirement must succeed before database deactivation
- if retirement fails, the champion remains active and the failure is recorded
- native Edgeforce models remain available when external ML is quarantined
- a later tournament must independently earn promotion before external inference resumes
- historical or live model performance does not guarantee betting profit

## Previous build — V58 First Champion Tournament

V58 completes the evidence layer required for the first heavyweight external-ML tournament and adds a sport-by-sport champion scoreboard.

### First tournament orchestration
The authenticated `POST /api/ml/first-tournament` workflow:
1. records the pre-tournament champion set
2. runs the V58 ML activation path with a real external tournament
3. isolates candidates from the exact tournament run
4. ranks algorithms within each sport / market group
5. records winner, runner-up and composite-score margin
6. compares holdout Brier score with the sportsbook baseline
7. records new, replaced and retained champions
8. verifies every promoted champion against the hosted service's persistent artifact store
9. persists the launch decision and evidence

### Hosted champion artifact verification
The Python service now exposes authenticated `GET /champions`.

For every champion manifest it reports:
- sport / market
- algorithm
- service model ID
- serialized artifact presence
- serialized artifact size

A champion row in Edgeforce's database is not considered launch-ready when its corresponding hosted `.joblib` artifact is missing.

### First-tournament evidence grades
V58 reports:
- `BLOCKED`
- `NO_EVIDENCE`
- `AWAITING_CHAMPION`
- `ARTIFACT_MISMATCH`
- `LIMITED_COVERAGE`
- `VERIFIED`

`READY_AWAITING_EVIDENCE` remains a safe activation state when the hosted service works but no challenger has earned promotion.

### Sport / market algorithm leaderboard
For each tournament group V58 reports:
- winning algorithm
- runner-up
- winner composite score
- Brier Skill Score
- sportsbook baseline Brier
- market-relative Brier improvement
- winner / runner-up score margin
- number of eligible candidates
- top five algorithms

This is the first Edgeforce view intended to answer **which modeling family actually won out-of-sample for each sport/market**, rather than which algorithms are merely installed.

### Champion history
Migration `v47` adds:
- `ml_first_tournament_runs`
- `external_ml_champion_history`

Champion history records promotions, replacements and retained incumbents with holdout evidence and promotion reasons.

### APIs and UI
- run: authenticated `POST /api/ml/first-tournament`
- status: `GET /api/ml/first-tournament`
- intelligence: `GET /api/intelligence/ml-champions`
- regression: `GET /api/testing/ml-first-tournament`
- dashboard: **V58 First Champion Tournament**
- modeling workspace: `/models`

### Release identity
- build: `V58`
- app: `58.0.0`
- package: `0.58.0`
- model: `edgeforce-v58`
- migration: `v47`
- ML service: `edgeforce-ml-service-v58`

### Guardrails
- a tournament winner is not automatically a production champion
- a database champion without its hosted serialized artifact fails launch evidence
- an external ML service outage leaves native Edgeforce models active
- insufficient settled history can legitimately produce no champion
- winner / runner-up rankings are based on holdout evidence, not profitability claims
- historical edge does not guarantee future betting profit

## Previous build — V57 ML Deployment Automation

V57 automates the production handoff from the V56 activation-ready stack to a verified hosted ML service.

### Deployment chain
The new `.github/workflows/deploy-ml-service.yml` workflow performs the following sequence:

1. deploy the Render ML service
2. prefer the Render REST API for an exact commit deploy
3. fall back to the service's secret deploy hook when API credentials are unavailable
4. wait until the service answers `/health`
5. verify `edgeforce-ml-service-v57`
6. verify the running Render git commit when the exact API path is used
7. verify required baseline algorithms
8. verify the `edgeforce-ml-predict-v1` → `edgeforce-ml-predict-result-v1` contract
9. ensure Edgeforce production receives the ML service URLs and keys
10. use the existing hardened production deployment workflow for the Edgeforce runtime
11. call `POST /api/ml/activate`
12. accept only `ACTIVE` or `READY_AWAITING_EVIDENCE`
13. persist a deployment attestation

Automatic ML deployment after a successful main-branch verification is opt-in through the repository variable `ML_SERVICE_AUTO_DEPLOY=true`. Manual workflow dispatch remains available regardless of that variable.

### Render deployment identity
The Python service health payload now reports Render's runtime deployment metadata:
- git commit
- git branch
- repository slug
- service ID
- service name
- external URL
- CPU count
- instance ID

This lets Edgeforce verify the actual running container instead of assuming a deploy request reached the intended revision.

### Deployment doctors
- `npm run doctor:ml-service`
  - health endpoint
  - service version
  - exact Render commit when required
  - baseline algorithm availability
  - prediction contract handshake
- `npm run doctor:ml-activation`
  - calls the production Edgeforce activation endpoint
  - optionally runs the heavyweight tournament
  - only accepts `ACTIVE` or `READY_AWAITING_EVIDENCE`

### Vercel runtime wiring
The canonical production deploy accepts the Render base URL and ML service key from GitHub Actions secrets and injects:
- `ML_HEALTH_SERVICE_URL`
- `ML_PREDICTION_SERVICE_URL`
- `ML_PREDICTION_SERVICE_KEY`
- `ML_TRAINING_SERVICE_URL`
- `ML_TRAINING_SERVICE_KEY`
- `ML_PROMOTION_SERVICE_URL`
- `ML_ACTIVATION_SECRET`

For a manual ML-service deployment, the V57 workflow also updates the corresponding Vercel Production environment variables and then dispatches the existing hardened production deploy workflow.

### Required GitHub Actions secrets
For live V57 deployment automation:
- `RENDER_ML_SERVICE_BASE_URL`
- `ML_SERVICE_KEY`
- `ML_ACTIVATION_SECRET`
- `EDGEFORCE_PRODUCTION_URL`
- `VERCEL_TOKEN`

Use either:
- `RENDER_API_KEY` + `RENDER_ML_SERVICE_ID` for exact commit deployments, or
- `RENDER_ML_DEPLOY_HOOK_URL` as the fallback deployment trigger

### Durable deployment attestation
Migration `v46` adds `ml_service_deployment_attestations`, recording:
- Edgeforce model version
- ML service version
- Render service identity
- running git commit / branch
- Render deploy ID
- health result
- prediction handshake
- activation state
- tournament state
- active champion count
- available algorithms
- deployment error/details

APIs:
- `GET /api/ml/deploy-attest`
- authenticated `POST /api/ml/deploy-attest`
- regression: `GET /api/testing/ml-deployment`

### UI
The dashboard and `/models` now include **V57 ML Deployment Automation**, showing the attested commit, service health, prediction handshake, tournament state, and active champion count.

### Release identity
- build: `V57`
- app: `57.0.0`
- package: `0.57.0`
- model: `edgeforce-v57`
- migration: `v46`
- ML service: `edgeforce-ml-service-v57`

### Guardrails
- deployment success does not imply model promotion
- the exact Render commit is checked when the API deployment path is available
- external ML activation remains fail-closed
- `READY_AWAITING_EVIDENCE` is treated as a valid safe deployment state
- native Edgeforce models remain available if Render deployment, health, inference, or activation fails
- model performance remains probabilistic and is never treated as guaranteed profit

## Previous build — V56 ML Service Activation

V56 takes the V55 heavyweight Python tournament service from a repository component to an activation-ready production service with explicit deployment, health, circuit-breaker, handshake and activation states.

### Render deployment blueprint
A root-level `render.yaml` now defines the `edgeforce-ml` Docker web service with:
- Docker build from `ml-service/Dockerfile`
- Ohio region
- explicit `2c-8g` compute plan
- `/health` health check
- persistent 10 GB disk mounted at `/data/models`
- one instance, because Render services with an attached persistent disk are intentionally single-instance
- secret `ML_SERVICE_KEY`
- model-store, sample-size and PyMC controls

The service container honors the hosting platform's `PORT` variable and defaults to port 10000.

### ML service health and circuit breaker
V56 adds `mlServiceHealth.ts`:
- derives a health URL from the configured service endpoints or `ML_HEALTH_SERVICE_URL`
- verifies `/health`
- records service version, latency and algorithm availability
- records persistent health snapshots in migration v45
- counts consecutive failures
- opens a bounded circuit after the configured failure threshold
- automatically bypasses external ML inference while the circuit is open
- leaves all native Edgeforce models active during external-service failure
- probes service health during the hourly heartbeat

Default controls:
- `ML_SERVICE_HEALTH_TIMEOUT_MS=5000`
- `ML_SERVICE_HANDSHAKE_TIMEOUT_MS=7000`
- `ML_SERVICE_FAILURE_THRESHOLD=3`
- `ML_SERVICE_CIRCUIT_COOLDOWN_MS=300000`

### Prediction contract handshake
Before activation, Edgeforce sends an empty `edgeforce-ml-predict-v1` request to the deployed service and requires an `edgeforce-ml-predict-result-v1` response.

A service that is reachable but does not implement the expected inference contract is not considered activation-ready.

### Activation state machine
The new V56 activation workflow reports one of five states:
- `UNCONFIGURED`
- `UNHEALTHY`
- `READY`
- `READY_AWAITING_EVIDENCE`
- `ACTIVE`

`ACTIVE` requires all of the following:
1. service endpoints configured
2. successful health check
3. successful prediction-schema handshake
4. successful tournament validation
5. at least one promoted external ML champion

Deploying the container alone therefore cannot silently turn on heavyweight ML predictions.

### Activation workflow
- status: `GET /api/intelligence/ml-service`
- authenticated activation: `POST /api/ml/activate`
- deterministic state regression: `GET /api/testing/ml-activation`
- dashboard: **V56 ML Service Activation**
- modeling workspace: `/models`

The activation call can health-check, handshake, run the external tournament and then report the actual production state.

### Durable activation audit
Migration `v45` adds:
- `ml_service_health_snapshots`
- `ml_service_activation_runs`

This preserves service latency/failures, circuit state, algorithm availability, handshake results, tournament result and the final activation decision.

### Release identity
- build: `V56`
- app: `56.0.0`
- package: `0.56.0`
- model: `edgeforce-v56`
- migration: `v45`

### Guardrails
- external ML outages never disable native Edgeforce modeling
- the service is not labeled active merely because deployment succeeded
- the prediction contract must match before inference is trusted
- the first tournament still uses the V55 untouched chronological holdout and incumbent-improvement gates
- persistent artifact storage is mandatory for stable champion inference
- an external model remains a probabilistic estimate, not a guarantee of betting profit

## Previous build — V55 External ML Tournament Engine

V55 adds a separate containerized Python training/inference service for heavyweight machine-learning algorithms while keeping the production Edgeforce web/Worker runtime lightweight.

### Algorithm tournament
For each eligible sport and sport/market group, the service can train and compare:
- L2 logistic regression
- Random Forest
- histogram gradient boosting
- XGBoost
- LightGBM
- CatBoost
- stacking ensembles
- PyMC Bayesian logistic regression

The service reports unavailable libraries explicitly; an algorithm is never marked active merely because it appears in the catalog.

### Leakage-safe dataset
V55 reuses V54's stable feature contract:
- sportsbook implied probability
- multi-book consensus probability
- consensus agreement / dispersion
- sharp and public probabilities
- sharp-public gap
- context score / coverage / critical coverage
- sport-specific pre-outcome features

Previous Model Council / Expert Suite votes are excluded from the tournament feature vector so the heavyweight models do not train on their own downstream output.

### Chronological tournament evaluation
Every algorithm receives time-ordered rows and is evaluated with:
- 70% fit window
- 15% probability-calibration window
- 15% untouched holdout
- Brier score
- log loss
- accuracy
- calibration error
- sportsbook baseline Brier/log loss
- Brier Skill Score versus the sportsbook
- a composite market-relative tournament score

### Champion / challenger promotion
The Python service does **not** promote its own winner.

1. the service returns all candidates and a candidate winner
2. Edgeforce compares that winner with the incumbent external-ML champion
3. the challenger must clear `ML_TOURNAMENT_PROMOTION_MARGIN`
4. Edgeforce explicitly calls the service's `/promote` endpoint
5. only then is the service champion manifest changed
6. the corresponding Edgeforce champion record is updated

If promotion fails or the service is unavailable, the incumbent remains production champion.

### Runtime inference
- `ML_PREDICTION_SERVICE_URL` points to the service `/predict` endpoint
- only the promoted champion for the sport/market is used
- its calibrated probability enters the existing **External ML** expert vote
- live champion predictions are persisted for subsequent validation and drift analysis
- the legacy V53 external prediction contract remains available as a fallback

### Durable registry
Migration `v44` adds:
- `external_ml_tournament_runs`
- `external_ml_candidates`
- `external_ml_champions`
- `external_ml_prediction_snapshots`

Every algorithm result, holdout score, promotion decision and production champion is inspectable.

### Service deployment
The heavyweight service lives under `ml-service/` with:
- FastAPI application
- pinned Python requirements
- Dockerfile
- persistent `MODEL_STORE_DIR` volume support
- Bearer authentication through `ML_SERVICE_KEY`
- `/health`, `/train`, `/promote`, and `/predict` endpoints

A production deployment must use persistent storage for serialized model artifacts. Edgeforce stores champion metadata, while the service retains the corresponding trained model files.

### Edgeforce APIs and UI
- dashboard: **V55 External ML Tournament**
- modeling workspace: `/models`
- status: `GET /api/intelligence/ml-tournament`
- authenticated tournament run: `POST /api/ml/tournament`
- deterministic promotion regression: `GET /api/testing/ml-tournament`

### Default tournament controls
- `ML_TOURNAMENT_MIN_SAMPLE=120`
- `ML_TOURNAMENT_LOOKBACK_ROWS=30000`
- `ML_TOURNAMENT_MAX_GROUP_ROWS=6000`
- `ML_TOURNAMENT_GROUPS_PER_REQUEST=2`
- `ML_TOURNAMENT_PROMOTION_MARGIN=0.01`
- `ML_TRAINING_TIMEOUT_MS=900000`

### Release identity
- build: `V55`
- app: `55.0.0`
- package: `0.55.0`
- model: `edgeforce-v55`
- migration: `v44`

### Guardrails
- external service failure is isolated from native Edgeforce recalibration
- training alone cannot alter production champion state
- all challengers are evaluated on untouched chronological holdout data
- promotion requires market-relative evidence plus an incumbent-improvement margin
- model artifacts must persist outside ephemeral container storage
- historical performance does not guarantee future profitability

## Previous build — V54 Trained Sport-Specific ML

V54 turns Edgeforce's settled prediction history into independently trained sport-specific machine-learning models. Promoted models become a new **Trained Sport ML** vote inside the V53 Expert Model Council; held models remain diagnostic-only.

### Native training engine
V54 trains calibrated L2-regularized logistic models for supported sports and, when sample size permits, sport/market combinations:
- NFL and NCAAF
- MLB
- NBA, WNBA and NCAAB
- NHL
- Soccer
- Tennis and Table Tennis
- UFC/MMA and Boxing
- Golf and Motorsports
- Cricket, Rugby, Volleyball and Lacrosse
- Esports

The feature vector intentionally excludes previous Expert Suite/model-council votes so a model cannot learn from its own prior output. Training uses sportsbook implied probability, multi-book consensus/sharp-public structure, context quality and sport-specific features captured before settlement.

### Chronological validation
Each candidate uses time-ordered data:
- first 70% — model fitting
- next 15% — probability calibration
- final 15% — untouched holdout

Promotion requires:
- minimum settled sample size
- minimum holdout sample size
- positive Brier Skill Score versus sportsbook implied probability
- holdout log loss that is not worse than the market baseline
- acceptable holdout calibration error

A candidate that fails any gate is stored as **HELD** and cannot influence live recommendations.

### Runtime integration
- promoted artifacts are stored in `trained_model_artifacts`
- live markets load the newest promoted sport/market artifact
- the trained probability is added as `Trained Sport ML` inside the Expert Modeling Suite
- prediction snapshots are persisted for later validation and drift analysis
- daily recalibration automatically retrains eligible candidates
- training is bounded with deterministic mini-batches and a configurable recent-history cap

### APIs and UI
- main dashboard: **V54 Trained Sport-Specific ML**
- dedicated modeling page: `/models`
- status: `GET /api/intelligence/trained-models`
- authenticated manual training: `POST /api/ml/train`
- deterministic regression: `GET /api/testing/trained-models`
- expert catalog: `GET /api/sports/models`

### Default training controls
- `TRAINED_MODEL_MIN_SAMPLE=80`
- `TRAINED_MODEL_MIN_HOLDOUT=20`
- `TRAINED_MODEL_LOOKBACK_ROWS=30000`
- `TRAINED_MODEL_MAX_GROUP_ROWS=4000`
- `TRAINED_MODEL_BATCH_SIZE=256`
- `TRAINED_MODEL_L2=0.015`
- `TRAINED_MODEL_STEPS=700`
- `TRAINED_MODEL_LR=0.035`

### Release identity
- build: `V54`
- app: `54.0.0`
- package: `0.54.0`
- model: `edgeforce-v54`
- migration: `v43`

### Guardrails
- no model is promoted because it has a good in-sample fit
- the untouched chronological holdout must beat the sportsbook probability baseline
- prior council/expert predictions are excluded from training features to prevent recursive confidence inflation
- insufficient-history sports remain inactive instead of receiving fabricated probabilities
- promoted models continue to pass through Edgeforce's existing validation, governance, context and portfolio-risk layers
- historical success does not guarantee future profitability

## Previous build — V53 Expert Modeling Suite

V53 turns professional sports-prediction methods into a dedicated, inspectable modeling layer instead of hiding every approach inside one blended score.

### Native quantitative models
The production model council can now consume an expert consensus built from models that activate only when their required inputs are present:
- Bayesian market-prior shrinkage
- Elo ratings
- Glicko ratings with rating uncertainty
- Bradley-Terry pairwise strength
- Poisson score distributions
- Skellam-style score-margin pricing
- Dixon-Coles low-score soccer correction
- expected-goals / shot-quality strength
- player projection distributions
- sharp/public cross-book consensus
- external trained-model ensemble when configured

The Expert Suite is added as a learned model-council vote, so its influence remains subject to Edgeforce calibration, validation and governance instead of bypassing them.

### External professional ML bridge
Cloudflare/Next.js does not natively host Python/R statistical libraries. V53 therefore adds a normalized external model-service contract through:
- `EXPERT_MODEL_SERVICE_URL`
- `EXPERT_MODEL_SERVICE_KEY`
- `EXPERT_MODEL_SERVICE_TIMEOUT_MS`

A connected service can return predictions from:
- XGBoost
- LightGBM
- CatBoost
- PyMC
- Stan
- scikit-learn
- PyTorch / TensorFlow

Returned probabilities are confidence-weighted, fused into the market feature set, and then enter the normal Edgeforce model council.

### Premium sports-data connector catalog
The Expert Modeling Suite exposes license-gated connector slots for:
- Stats Perform Opta / Opta Predictions
- Sportradar Sports Data / Insights
- Synergy Basketball
- Second Spectrum
- PFF Data
- MLB Statcast / Baseball Savant

Closed vendor algorithms are not copied. A platform is shown as connected only when authorized access is configured.

### Model-development workflow
V53 also reserves the expert workflow for:
- Optuna hyperparameter optimization
- MLflow experiment tracking and model registry
- SHAP model explainability

### Expert Modeling UI
- main dashboard section: **V53 Expert Modeling Suite**
- dedicated page: `/models`
- API: `GET /api/intelligence/expert-models`
- catalog API: `GET /api/sports/models`
- deterministic regression: `GET /api/testing/expert-models`

The UI shows each component as **LIVE**, **BUILT IN**, **CONNECTED**, **BRIDGE**, or **LICENSE**, so unavailable software is never presented as active.

### Release identity
- build: `V53`
- app: `53.0.0`
- package: `0.53.0`
- model: `edgeforce-v53`
- migration: `v42` (no schema change)

### Guardrails
- expert model count is not treated as evidence of profitability
- native methods activate only when the input contract is satisfied
- premium data requires the user's own licensed access
- external model output remains subject to V51 validation, calibration, drift and portfolio-risk controls
- no external model is allowed to bypass Edgeforce recommendation-quality gates

## Previous build — V52 Live Comeback / Halftime Buy-Low Watch

V52 adds a first-class live comeback module to the existing EdgeForce 2 system without removing the V51 validation, context, parlay, prediction-market, portfolio, or calibration capabilities.

### Live comeback intelligence
- watches supported live-window markets for meaningful probability moves against a selection
- requires the EdgeForce simulation to remain materially above the current market probability
- uses dynamic confidence, model agreement, line-history depth, context readiness, freshness, and regime stability
- separates stronger `BUY_LOW_REVIEW` setups from developing `WATCH` setups
- surfaces the module directly on the main dashboard and at `GET /api/live-comeback`

### Hard guardrail
V52 does **not** infer score, clock/period, possession/server, or live injury state from odds movement. Every `BUY_LOW_REVIEW` row is marked `requiresGameStateConfirmation: true`. The signal means the price/model conditions cleared the review gates, not that an entry is automatically safe or profitable.

### Default buy-low review gates
- supported sport and likely live time window
- ELITE or STRONG grade
- simulation probability at least 62%
- dynamic confidence at least 58%
- simulation-to-market edge at least 8 percentage points
- adverse market move at least 3 percentage points
- fresh data, stable/non-dislocated regime, recommendation-ready context, and at least two line snapshots

### Validation
- deterministic `GET /api/testing/live-comeback` regression verifies a strong setup is promoted, a weak setup is rejected, and game-state confirmation remains mandatory
- local and hosted smoke checks cover the new endpoint
- release audit requires the engine, API, test route, and dashboard panel

### Release identity
- build: `V52`
- app: `52.0.0`
- package: `0.52.0`
- model: `edgeforce-v52`
- migration: `v42` (no schema change)

## Previous build — V51 Prediction Validation Laboratory

V51 adds an evidence-grade validation layer that measures whether Edgeforce predictions improve out of sample before learned models retain full runtime influence.

### Validation metrics
- Brier score and log loss
- calibration error and probability reliability buckets
- confidence-band predicted-vs-actual hit rates
- sportsbook offered-price baseline
- Brier Skill Score versus offered market probability
- log-loss improvement versus the market baseline
- holdout-set Brier/log-loss/calibration
- walk-forward out-of-sample folds
- ROI and signed CLV
- simulation-vs-model paired Brier comparison with a 95% interval
- context-rich versus context-thin performance comparison

### Evidence grades
Each model / sport / market group is classified as:
- **VERIFIED** — deep history, multiple walk-forward folds, positive market-relative skill and strong holdout calibration
- **QUALIFIED** — clears minimum out-of-sample, calibration, CLV and skill gates
- **PROVISIONAL** — promising but not enough evidence for full promotion
- **INSUFFICIENT** — sample or holdout history is too small
- **FAILED** — holdout, calibration or market-relative skill is materially weak

Only VERIFIED and QUALIFIED groups are promotion-eligible.

### Runtime protection
- validation snapshots now produce runtime multipliers
- FAILED models are heavily braked
- PROVISIONAL / INSUFFICIENT models retain reduced influence
- evidence-qualified models may keep or receive a small positive validation multiplier
- validation multipliers stack with existing recalibration and champion/challenger governance controls

### Historical feature preservation
Settlement feedback now retains the original model-run feature snapshot, including:
- context quality
- context provenance
- raw simulation probability
- model council probability
- dynamic confidence
- regime / uncertainty
- consensus
- player context
- sport features
- model votes

This lets the validation lab test whether context and simulation actually improved settled outcomes.

### APIs and automation
- `GET /api/intelligence/validation-lab` — current validation report and latest durable snapshots
- `POST /api/intelligence/validation-lab` — authenticated manual validation run
- `GET /api/testing/validation-lab` — deterministic evidence-gate regression
- scheduled recalibration now runs prediction validation alongside calibration, SGP learning and model governance
- validation results are stored in `validation_runs` and `validation_snapshots`

### Dashboard
The V51 dashboard shows:
- settled prediction sample size
- holdout Brier score
- holdout calibration error
- market-relative Brier skill
- CLV coverage
- context-rich Brier delta
- simulation-vs-model Brier delta
- verified / qualified / provisional / failed model counts

### Release identity
- build: `V51`
- app: `51.0.0`
- package: `0.51.0`
- model: `edgeforce-v51`
- migration: `v39`

### Validation caveats
- context-rich versus context-thin comparisons are observational and may be confounded by sport, market, timing and difficulty
- statistical validation reduces unsupported confidence but does not guarantee future profitability
- a model can be accurate over one historical window and still drift later; V42 governance and V51 validation therefore remain active together


## Current build — V50 Real Context Data Network

V50 connects V49's context-quality framework to live supplemental event data instead of relying only on user-configured provider payloads.

### Credential-free live context sources
- ESPN public site feeds are used as a best-effort supplemental source for supported major leagues
- Open-Meteo is used for hourly event-time weather when an outdoor venue can be resolved
- no new secret is required for these supplemental sources
- configured paid/credentialed context providers remain authoritative and override public supplemental values

### Event-level enrichment
Supported event matching currently covers:
- NFL and college football
- NBA, WNBA and men's college basketball
- MLB
- NHL
- MLS and English Premier League
- UFC/MMA event matching where ESPN exposes compatible schedule data

For matched events Edgeforce can add:
- venue identity and indoor/outdoor state
- league injury context
- player injury/availability status
- directional team injury burden
- QB injury context for football
- goalie injury context for hockey
- confirmed probable starter signals when exposed in pregame summaries
- lineup confirmation signals when sufficient starter data is exposed
- rest-day differential from team schedules
- season-record form differential
- outdoor weather at scheduled event time

### Weather enrichment
Open-Meteo forecasting adds:
- temperature
- precipitation probability
- precipitation amount
- wind speed
- wind gusts
- a normalized weather-impact score used as context/volatility input

Indoor venues explicitly satisfy the weather-context requirement with a neutral weather value rather than being treated as missing.

### Source provenance
Each injected context field records:
- source
- provider ID
- field name
- observation time
- confidence
- source status
- optional detail payload such as venue and forecast observations

Field-level provenance is persisted with model runs and surfaced through the context-intelligence API.

### Provider priority
1. public ESPN/Open-Meteo data fills missing context
2. configured WEATHER / INJURIES / STATS providers run afterward
3. configured providers override public values when both provide the same field

This lets Edgeforce start with real context immediately while remaining upgradeable to premium feeds without changing model code.

### Operational controls
- public context is enabled automatically in production and may be explicitly disabled
- event count, summary count, schedule count and request timeout are bounded by environment variables
- endpoint responses are cached by URL to reduce repeated upstream traffic
- V49 context quality still decides whether the resulting context is complete enough for recommendation-grade confidence

### APIs and validation
- `GET /api/intelligence/context` now reports public-network diagnostics and field-level provenance coverage
- `GET /api/testing/public-context-network` validates ESPN event matching, venue parsing, injury parsing, QB directionality and rest-day calculation
- hosted smoke tests validate the V50 context/parlay schema
- Worker build validation requires the V50 schema marker before deployment

### Release identity
- build: `V50`
- app: `50.0.0`
- package: `0.50.0`
- model: `edgeforce-v50`
- migration: `v38` (no schema change required)

### Data-source caveats
- ESPN site endpoints are public-facing supplemental feeds, not a contracted SLA-backed data service
- Edgeforce treats them as lower-confidence than configured premium providers
- any upstream failure leaves the affected context missing rather than inventing values
- Open-Meteo weather requires successful venue resolution; unresolved venues remain missing
- context data improves the information set but does not guarantee predictive accuracy


## Current build — V49 Context Intelligence

V49 turns context from an optional feature bag into a scored, sport-aware input contract used by every recommendation and automated decision path.

### Sport-aware context profiles
- NFL / NCAAF: quarterback, injuries, trenches, efficiency, rest, travel and weather
- MLB / NPB: starting pitcher, lineup, bullpen, park, weather, handedness and rest
- NBA / WNBA / NCAAB: injuries, lineup, pace, efficiency, shooting, rest and travel
- NHL: starting goalie, injuries, lineup, special teams, shot quality, rest and travel
- soccer: lineup, injuries, keeper, xG, form, tactical and weather context
- tennis / table tennis: surface, serve, return, form, fatigue and head-to-head context
- UFC / MMA: striking, grappling, cardio, takedown defense, weight cut, reach and recent form
- player markets add projection and availability requirements automatically

### Context quality
Every market now receives:
- weighted context coverage
- critical-context coverage
- source-quality score
- context-quality grade: COMPLETE / GOOD / PARTIAL / THIN / NONE
- missing critical and optional dimensions
- explicit `recommendationReady` state

Context quality directly affects dynamic confidence, grade promotion, stake scaling and V48 recommendation eligibility. Missing critical information therefore reduces confidence instead of silently behaving like neutral information.

### Provider operations
- weather context cache defaults to 10 minutes
- injury context cache defaults to 3 minutes
- statistics context cache defaults to 15 minutes
- provider failover, circuit breaking and payload-quality checks remain active
- cached context is reused across the live board, parlay endpoint, public scan and scheduled automation

### Decision-path consistency
The same context-enriched markets now feed:
- live board
- 2/3-leg recommendation engine
- public scan API
- scheduled model scan
- automated decision engine
- persisted model-run feature snapshots

### APIs and validation
- `GET /api/intelligence/context` — configured context providers, overall quality summary and sport-by-sport coverage
- `GET /api/testing/context-quality` — deterministic NFL, MLB and player-prop context regression
- dashboard shows context-ready rows and average context coverage
- smoke and release audit require context gating in recommendation and automation paths

### Release identity
- build: `V49`
- app: `49.0.0`
- package: `0.49.0`
- model: `edgeforce-v49`
- migration: `v38` (no schema change required)

### Guardrails
- context quality measures data completeness and source quality; it does not prove the context is predictive
- missing context cannot increase recommendation confidence
- context provider data is not fabricated when a feed is not configured or unavailable
- simulations, probabilities and recommendation tiers remain estimates rather than guaranteed outcomes


## Current build — V48 Recommendation Quality + Risk Tiers

V48 separates sportsbook analysis from recommendations. A combination can have interesting modeled value without being promoted to the normal recommendation board.

### Recommendation tiers
- **RECOMMENDED** — strict ELITE/STRONG source legs only, with joint simulation, per-leg simulation, dynamic confidence, context coverage, market-model agreement, consensus depth and freshness gates all cleared
- **VALUE WATCHLIST** — positive modeled value remains visible when one or more normal recommendation gates are not yet cleared
- **HAIL MARY** — extreme underdogs, very large combined payouts, low joint probability or severe model-vs-simulation divergence are isolated from normal recommendations
- **REJECTED** — non-positive modeled parlay EV is removed from all visible recommendation tiers

### Default recommendation gates
- minimum joint simulated probability: `52%`
- minimum simulated probability per leg: `60%`
- minimum average dynamic confidence: `58%`
- maximum model-vs-simulation gap: `15 percentage points`
- minimum context coverage: `50%`
- extreme-underdog flag: `+400` or longer
- Hail Mary combined-price flag: `+1000` or longer

All thresholds are explicit in the parlay API response and may be overridden by query parameters for analysis without changing the default recommendation standard.

### Parlay diagnostics
Every scored parlay now exposes:
- joint and independent probability
- 95% joint-simulation interval and simulation run count
- combined market odds and fair parlay odds
- modeled expected value
- minimum leg simulation probability
- average dynamic confidence
- context coverage
- maximum model-vs-simulation divergence
- extreme-underdog count
- recommendation tier, reasons and risk flags

### Dashboard
- the live dashboard has separate cards for Recommended, Value Watchlist and Hail Mary
- extreme longshots no longer appear beside normal recommendations
- if nothing clears every recommendation gate, the dashboard explicitly shows HOLD rather than promoting a lower-confidence combination
- the existing 2–20 leg probability-set tools remain available for analysis, but are distinct from the recommendation-quality board

### Validation
- deterministic regression coverage proves Recommended, Value Watchlist, Hail Mary and Rejected classifications
- smoke testing requires all three visible API boards and the 52% default joint threshold
- release audit requires context/divergence/EV gates and visible dashboard separation

### Release identity
- build: `V48`
- app: `48.0.0`
- package: `0.48.0`
- model: `edgeforce-v48`
- migration: `v38` (no schema change required)

### Guardrails
- recommendation tiers are model classifications, not guarantees of betting outcomes or profit
- missing context reduces recommendation eligibility instead of being silently treated as complete information
- large model-vs-simulation disagreement is treated as risk until supporting context improves
- Hail Mary classification means longshot analysis only; it is not a recommendation


## Current build — V47 Adaptive Full-Slate + Live Parlay Engine

V47 expands the verified V46 production feed without returning to high-volume provider fan-out. It adds quota-aware sport expansion, adaptive refresh cadence, and moves parlay generation onto the same live production ingestion path as the Daily / Weekly boards.

### Adaptive full-slate provider
- keeps the verified `upcoming` bootstrap for the next 8 live/upcoming events across sports
- uses the free active-sports catalog to rank expansion targets
- prioritizes NFL, NCAAF, MLB, NBA, NCAAB, WNBA, NHL, MMA, MLS, then tennis/soccer and secondary sports
- expands only a bounded number of sport feeds per refresh
- defaults expansion to `h2h` so broad moneyline coverage costs less than requesting every featured market for every sport
- automatically narrows the expansion set when refresh cadence accelerates near event start
- progressively enters CONSERVE and BOOTSTRAP_ONLY modes as quota approaches the configured reserve
- serializes paid expansion requests and retries HTTP 429 only once after a delay
- caches live results according to the adaptive refresh target

### Live parlay production path
- `GET /api/parlays` now uses `ingestOdds()` rather than demo markets
- supports 2-leg and 3-leg live parlays
- supports today/week scopes
- supports a caller-selected minimum joint probability with `minJoint`
- retains shared-event state simulation, learned SGP correlation, and Gaussian-copula fallback from V46/V35
- returns the live source, provider, target book, candidate-leg count, warnings, and generated parlays

### V47 refresh policy
- EXPANDED: wider sport coverage when quota headroom is strong
- BALANCED: moderate expansion as quota headroom declines
- CONSERVE: maximum two expansion sports when quota is low
- BOOTSTRAP_ONLY: no paid expansion when quota is near the configured reserve
- event proximity can accelerate refreshes while simultaneously narrowing the number of paid sport expansions

### Validation
- deterministic policy regression verifies expanded, urgent, conserve, and reserve modes
- smoke testing requires the live-parlay endpoint to use the production ingestion path
- release audit rejects a V47 build that falls back to demo-backed parlays or loses the adaptive provider policy

### Release identity
- build: `V47`
- app: `47.0.0`
- package: `0.47.0`
- model: `edgeforce-v47`
- migration: `v38` (no schema change required)

### Guardrails
- the provider budget controller reduces request volume; it does not guarantee a fixed credit burn because provider response costs depend on markets actually returned
- full-slate coverage expands opportunistically and may intentionally narrow as quota approaches reserve
- live odds, model probabilities, simulations and parlay probabilities remain estimates, not guarantees of outcome or profitability


## Current build — V46 Unified Event-State Prediction

V46 upgrades same-game pricing from probability-only correlation to shared event-state simulation whenever the selected markets are structurally supported.

### Shared event-state simulation
- same-event moneyline, spread, total and supported player-prop legs are evaluated inside the same simulated game state
- shared pace and team-performance shocks propagate into team scores and player outcomes
- player props use provider projection, standard deviation, availability and starter state when present
- low-scoring sports use discrete scoring behavior; higher-scoring sports use shared continuous event factors
- joint parlay probability is measured directly from scenario co-occurrence rather than reconstructed only from marginal leg probabilities
- pair correlations are estimated empirically from the shared simulated outcomes

### Safe fallback
- unsupported sports, partial markets, missing player projections and multi-event combinations retain the existing Gaussian-copula / learned-correlation fallback
- API responses identify the joint engine as `SHARED_EVENT_STATE` or `GAUSSIAN_COPULA_FALLBACK`
- parlay objects expose scenario coverage so downstream UI can distinguish empirical event-state pricing from fallback correlation

### Validation
- deterministic regression coverage requires an NBA moneyline + total + player-prop same-game set to route through `SHARED_EVENT_STATE`
- the existing positive/negative learned-correlation regression remains in place for fallback behavior
- release audit requires the shared event-state engine and regression route

### Release identity
- build: `V46`
- app: `46.0.0`
- package: `0.46.0`
- model: `edgeforce-v46`
- migration: `v38` (no schema change required)

### Guardrails
- shared event-state simulation is an estimate, not a guarantee of game outcomes or parlay success
- unsupported markets are not forced into the event-state engine
- empirical correlations are model-derived unless learned from settled historical wagers
- real-data, calibration, governance, portfolio, security and production controls from V45 remain active

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



