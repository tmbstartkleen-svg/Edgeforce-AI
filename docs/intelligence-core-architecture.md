# EdgeForce Intelligence Core — implementation contract

## Ownership and truthfulness
EdgeForce is the canonical **normalized analytics and historical observation repository** for the app; it cannot be the independent origin of live results, sportsbook quotes or injury reports. Those require authorized externally verified observations. AI-generated predictions are never labelled observed odds/results or 99%-confidence simulations without calibration evidence.

## Existing integration
The existing Cloudflare worker in `worker/index.ts` already schedules scans, injuries, decisioning, predictions, settlement and recalibration. The first PR adds the **pure planning core**, isolated from deployed crons to avoid accidentally increasing the existing CPU/subrequest failures. Follow-up integration should adapt the current cron routes to the planner, not run both schedulers concurrently.

## Pipeline
1. Authorized provider adapters collect external observations with provider, distinct upstream ID, timestamp and event ID.
2. Canonical team/player/event mapping deduplicates provider identifiers. Unmatched IDs go to quarantine, never silently joined.
3. Store raw immutable observations then normalized tables. PostgreSQL can serve current operational storage; add partitioned time-series/history tables and low-cost object storage for long-term raw payloads.
4. Agent scheduler dispatches batches to queues; consumers operate within hard request/CPU/latency budgets with leases, jitter, retries and per-upstream circuit breakers.
5. Separate models compute reproducible probabilities, calibration and expected value. A model forecast is not a live price.
6. Score and quote freshness gates block stale rows; published cards show observation time and upstream certification status.
7. Settle predictions only against verified final events; record Brier/log loss, CLV and outcomes for retraining and audit.

## Proposed persistence objects
- `source_registry`: upstream identity, capability, licensing/terms, latency, trust and API budget.
- `event_identity`, `team_identity`, `player_identity`: canonical keys and vendor mappings.
- `raw_observations`: append-only source snapshots keyed by provider/event/type/time/hash.
- `market_quotes`: sportsbook, line, price, recorded time, event and market canonical identity.
- `injury_reports`, `lineup_reports`, `player_stat_snapshots`, `live_score_snapshots`.
- `agent_runs`: planned/started/completed, budget, attempt, errors, lease, next eligible time.
- `model_forecasts`: version, features snapshot, forecast and confidence/calibration metadata.
- `settlement_outcomes`, `model_evaluations`: verified ground truth and calibration evidence.

## Operator acceptance gates
- No duplicated production schedulers.
- At most bounded tasks per invocation (planner defaults to 4).
- An aggregator's several bookmaker names count as one independent upstream.
- Stale or missing prices are excluded from actionable picks.
- Historical backfills cannot starve live data.
- Secrets stay in Cloudflare/GitHub managed secrets, never committed.
- Polling targets depend on provider entitlements and budgets; free APIs do not imply unlimited refresh.
- Tests: `node --test tests/intelligence-core-agent-planner.test.mjs`.

## Delivery status
This PR establishes the agent catalog, deterministic budget scheduler, observation schema guardrails and tests. It does **not** create background agents, storage migrations, source integrations, or deploy a new production pipeline. Those are explicit next integration stages.
