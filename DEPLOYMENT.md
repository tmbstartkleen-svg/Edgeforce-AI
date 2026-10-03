# Edgeforce AI V43 deployment

## Release strategy
lint → build → migration continuity → local production server → smoke → load gate → Vercel prebuilt preview → hosted smoke → release attestation → optional exact-artifact promotion → observe → rollback if needed.

## Required production configuration
Configure `MODEL_VERSION=edgeforce-v43`, a positive `DEFAULT_BANKROLL`, a Neon/Postgres connection exposed as `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, or `NEON_DATABASE_URL`, and at least one authorized live ODDS provider. The canonical native provider requires only `THE_ODDS_API_KEY`. Apply database migrations through `v38`.

GitHub Actions deployment also requires `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`.

## Health model
- `/api/health/live`: process liveness only.
- `/api/health/ready`: environment-aware service readiness.
- `/api/release/readiness`: release/dependency details without secret values.
- In production, readiness requires database connectivity, migration v38, secrets, bankroll configuration and an operational odds provider.

## Pre-release gates
- `npm run lint`
- `npm run build`
- `npm run check-migrations`
- local production-server smoke suite
- load check with zero failures and configured p95 ceiling
- hosted preview liveness/readiness/diagnostics/ops-status/dashboard checks
- V43 version, migration, real-data, governance, and static release-audit checks

## Preview and promotion
Use **Edgeforce Release Candidate** for preview validation only. V43 retains the direct-preview promotion block introduced in V41. Production releases must flow through **Edgeforce Production Deploy** so production environment validation, migration v38, provider certification, strict readiness, hosted smoke, release attestation, final certification, and rollback cannot be bypassed.

## Rollback
Use **Edgeforce Rollback** with an optional deployment URL/ID. The Vercel CLI is pinned to the V43 release toolchain.

## Observability
The hourly heartbeat records readiness when a database is configured. `/api/ops/status` surfaces recent heartbeats, release attestations, unresolved incidents and route performance. Live-board performance sampling is controlled with `PERFORMANCE_SAMPLE_RATE`.

## Performance defaults
- `PERFORMANCE_SAMPLE_RATE=0.10`
- `LOAD_REQUESTS=60`
- `LOAD_MAX_P95_MS=3000`

These can be tightened after observing real production traffic.

## Hobby cron compatibility
Vercel Hobby accepts cron schedules that run at most once per day. The Vercel cron configuration therefore runs settlement and heartbeat once daily for deploy compatibility. Hourly settlement and heartbeat are preserved through `.github/workflows/hourly-ops.yml`, which calls the production endpoints when the GitHub variable `EDGEFORCE_PRODUCTION_URL` and secret `CRON_SECRET` are configured.


## Canonical Vercel production project
The canonical production project is `edgeforce-ai2` (`prj_8edFTZzS8e6RZyMVm1mjxuGJnLPZ`). Repository-level `ignoreCommand` allows Git builds only for that project so the older duplicate `edgeforce-ai` and `edgeforce` projects no longer consume duplicate build quota.

## Automatic prebuilt production deployment
After **Verify Edgeforce** succeeds on `main`, **Edgeforce Production Deploy**:
1. targets the canonical Vercel project,
2. pulls the production environment,
3. validates the V43 app/model environment,
4. applies database migrations through v38,
5. builds with the pinned Vercel CLI,
6. deploys the prebuilt artifact directly to production,
7. runs hosted V43 smoke/readiness checks,
8. records a release attestation,
9. rolls back automatically if a hosted post-deploy check fails.

This path avoids Vercel's remote build quota because the application artifact is built in GitHub Actions before upload.


## Provider certification
Before production promotion, run an authorized `POST /api/providers/certify` and inspect `GET /api/launch-doctor?strict=1`. A certified ODDS provider is a hard requirement. Optional enrichment capabilities are reported as warnings when missing or degraded. Certification history is persisted when Postgres is configured.


## SGP correlation learning
V35 rebuilds learned same-event market-pair profiles during the scheduled recalibration workflow. Defaults are `SGP_CORRELATION_MIN_SAMPLE=20` and `SGP_CORRELATION_SHRINKAGE_SAMPLES=50`. These profiles supplement—not replace—the structural same-game heuristics. The production deployment remains gated by provider certification and the strict launch doctor.


## Sport micro-simulation
V36 routes supported full-game markets through sport-specific granular engines before generic team-score fallbacks. The production smoke suite requires all seven granular engine families to initialize and return valid probabilities. Player props remain on the distribution-aware prop engine unless a dedicated play-level prop model exists. Expensive 100,000-tier micro simulations are capped to 10,000 actual granular runs and the executed run count is retained for auditability.


## Consensus pricing
V37 fetches all healthy configured odds providers and forms a quality-weighted cross-book consensus while preserving the configured target sportsbook's price for wager EV/Kelly. Configure `TARGET_BOOKMAKER`, provider `*_MARKET_ROLE` / `*_CONSENSUS_WEIGHT`, and optional `ODDS_BOOK_ROLE_MAP` / `ODDS_BOOK_WEIGHT_MAP` JSON overrides for aggregator feeds.

Book roles are explicit configuration only. Edgeforce does not infer public ticket percentages, handle percentages, or sharpness from sportsbook prices. If both SHARP and PUBLIC roles are not present for a market, its structure remains `UNCLASSIFIED`.

Migration v36 stores quote-level consensus snapshots, dispersion, agreement, target-book availability, best-price opportunities and explicit market-role gaps for audit/history.


## Regime-aware uncertainty and confidence
V38 classifies each priced market as STABLE, VOLATILE, DISLOCATED, THIN, or UNKNOWN from consensus depth, price dispersion, and simulation precision. Historical calibration quality, model agreement, source freshness, distribution confidence, and cross-book agreement are combined into a dynamic confidence score. Low-confidence or dislocated rows are automatically downgraded and stake sizing is reduced. Simulation probabilities are shrunk toward calibrated historical and consensus baselines rather than being treated as certainty.


## Portfolio stress testing and drawdown control
V39 runs five portfolio-level loss scenarios after initial concentration-aware allocation. The optimizer reports 95% VaR/CVaR and modeled drawdown-breach probability, applies a continuous brake as current bankroll drawdown increases, and uniformly scales accepted positions when worst-scenario CVaR exceeds `PORTFOLIO_MAX_CVAR_PCT`. Configure `PORTFOLIO_STRESS_RUNS`, `PORTFOLIO_MAX_CVAR_PCT`, `PORTFOLIO_STRESS_DRAWDOWN_PCT`, and `PORTFOLIO_MIN_DYNAMIC_CONFIDENCE` to tune production risk posture. These are model controls, not guaranteed loss limits.


## Explainability, ablation and read-only what-if
V40 adds additive model-contribution reconstruction, leave-one-model-out ablation, feature-zeroing ablation, local feature sensitivity, fragility diagnostics, and a read-only scenario API. The smoke suite requires contribution reconstruction, component/feature coverage, model diagnostics, and an actual hypothetical what-if POST. What-if analysis must remain side-effect free: it must not persist odds, wagers, calibration state, model weights, or learning events.


## V41 final production certification
V41 adds a second, post-deploy certification layer after provider certification, strict launch-doctor readiness, hosted smoke tests, and release attestation. The authorized `POST /api/release/certify?strict=1` requires current release identity, required readiness checks, current provider certification, acceptable batch data quality, no stale/failed durable automation jobs, the hardened security posture, and a complete current-version release attestation. A non-2xx certification response causes the production workflow to enter the existing rollback step.

The first deployment can show scheduled jobs as `PENDING` until their configured schedules run; pending jobs are warnings, while a recorded failed or stale job is a strict certification blocker.

## Static release audit
`npm run release-audit` runs before preview and production deployment. It verifies V43 release/model/package/migration identity, required V41 routes and files, Vercel cron coverage, security controls, blank example secret values, absence of tracked local environment files, and workflow identity synchronization.

## Durable automation health
Migration v37 stores scheduler outcomes for heartbeat, settlement, scan, decision, and recalibration. `GET /api/automation/health` reports HEALTHY, STALE, FAILED, or PENDING by job. Scheduled scan and decision automation now consume learned weights and dynamic calibration profiles so automated scoring follows the same calibration path as interactive boards.

## Batch market data contract
`GET /api/data-quality` audits the active ingestion batch for structural validity, odds/probability bounds, freshness, duplicates, consensus depth, target-book coverage, and feature coverage. Severe invalidity, duplication, staleness, or an overall REJECT grade blocks strict final certification.


## V42 model governance
Migration v38 stores model-governance runs and per-model/sport/market snapshots. Scheduled recalibration now evaluates recent-vs-baseline probability drift and performance drift, assigns champion/challenger roles, and writes runtime multipliers. The learned-weight loader consumes those multipliers so WATCH, DRIFTING, and CRITICAL models are automatically throttled in live boards, scheduled scans, decisions, what-if analysis, and portfolio inputs that use the model council.

Default controls are `MODEL_GOVERNANCE_MIN_BASELINE=40`, `MODEL_GOVERNANCE_MIN_RECENT=20`, `MODEL_GOVERNANCE_RECENT_FRACTION=0.30`, `MODEL_GOVERNANCE_PROMOTION_MARGIN=0.015`, and `MODEL_GOVERNANCE_LOOKBACK_ROWS=30000`. Tune only after enough settled history exists to measure false drift alerts and promotion stability.


## V43 native real-data setup
The preferred sportsbook feed is The Odds API. Create one account/key and save it as `THE_ODDS_API_KEY` in either the Vercel Production environment or the GitHub Actions repository secrets. No provider URL is required. Edgeforce calls the provider's v4 API directly, discovers active sports, checks event availability for free, and then requests h2h/spreads/totals for the configured U.S. books. Defaults are DraftKings, FanDuel, BetMGM and William Hill/Caesars, an eight-day lookahead, 12 active sports per refresh, a 120-second cache, and a 25-credit reserve.

Neon integration variables are consumed directly. The production workflow no longer tries to pull encrypted database credentials into GitHub Actions; instead, `POST /api/release/bootstrap` runs migration v38 inside the deployed Vercel runtime using a deployment-only bootstrap secret.

A credential-free Polymarket feed is available as the prediction-market fallback. It supplements sportsbook pricing and is not used as a substitute for a certified live ODDS provider.


## Cloudflare Workers production target

Edgeforce V43 can also run on Cloudflare Workers through vinext. This is an independent production target and does not require Vercel.

Required GitHub Actions repository secrets for the manual **Deploy Edgeforce to Cloudflare** workflow:
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` scoped to the Cloudflare account and Worker deployment permissions
- `EDGEFORCE_DATABASE_URL` containing the Neon/Postgres connection string
- `THE_ODDS_API_KEY`

The workflow:
1. verifies the four required credentials are present,
2. runs vinext compatibility checks and builds the Worker,
3. applies database migrations through v38 directly to Neon/Postgres,
4. generates fresh ingest and cron authentication secrets,
5. deploys the Worker and encrypted production secrets together,
6. waits for Worker liveness,
7. certifies the live sportsbook provider,
8. requires the strict launch doctor,
9. runs the hosted V43 smoke suite,
10. publishes the Workers deployment URL in the GitHub job summary.

Sensitive values are never committed to the repository. Cloudflare's `nodejs_compat` runtime exposes configured text variables and secrets through `process.env`, which preserves Edgeforce's existing provider/database configuration pattern.

### Generated Worker config
The vinext build generates `dist/server/wrangler.json`. Production deployment must use that generated file rather than the source `wrangler.jsonc` entrypoint. Local deployment is therefore:

```bash
npm run deploy:cloudflare
```

Cloudflare Git builds should use:
- Build command: `npm run build:vinext`
- Deploy command: `npx wrangler deploy --config dist/server/wrangler.json`
- Root directory: blank

