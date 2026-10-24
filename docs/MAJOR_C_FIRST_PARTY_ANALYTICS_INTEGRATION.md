# EdgeForce first-party network — analytics capability integration contract

## Non-negotiable
Build independent EdgeForce analytics with owned computation, reproducible calculations, permitted data acquisition, timestamps, source identity, cost and license accounting. Referencing third-party products does NOT grant API access or license to scrape, reverse engineer, copy proprietary algorithms, trade marks or subscription-only data. No data feed is marked connected without an authenticated successful request and permitted terms. The Odds API is presumed quota-constrained until a real quota response proves otherwise. This plan is not a deployed integration.

## Platform capability matrix (engineering targets, not promised connections)

| Reference platform | EdgeForce-owned capability | Inputs and proof needed | Release gate |
| --- | --- | --- | --- |
| OddsJam | Cross-book +EV and arbitrage scanner, bet-sizing and promotion/boost evaluator | Independent permitted book quotes; exact outcome/event/line and settlement rules; real displayed and accepted prices; timestamp and max stake | Never show actionable arbitrage if lines, liquidity, freshness, commissions or settlement mismatch |
| Unabated | Fair-price estimator, no-vig comparison, sharp-source weighting, confidence interval and calibrated model estimates | Distinct independent source owners; reference prices; historical outcomes and model calibration | Label estimated probability; report break-even, probability edge, ROI and sample size; never use a sportsbook implied probability as an independent prediction |
| OpticOdds | Streaming feed adapter abstraction, normalized pregame/in-play/props data, history, Kalshi book-depth bridge | Licensed key/contract, documented permitted routes, bid/ask volume and update time | Adapter disabled by default; no invented entitlement; rate/budget protection and replay tests |
| Outlier Pro | Prop trends, player contextual baselines, boost/middle finder, filter workspace | Player IDs, historical minutes/usage/opponent data, permitted prop line prices, promotion terms | Display correlations, settlement and maximum eligible stakes; filter out stale/player-mismatch lines |
| BetBurger | Multi-region pregame/live arbitrage comparator and execution-risk diagnostics | Allowed international bookmakers, currency/fees, jurisdiction, market rules and available quote size | Exclude ineligible bookmakers, negative net edge and incompatible contract rules |

## First-party data planes
1. SCORE + SCHEDULE: approved scoreboard collectors by sport/league, event canonicalization and source timestamps. Do not label these records sportsbook odds.
2. CONTEXT: injuries, rosters, player stats, weather and lineups from approved access only, with provenance, refresh schedule and backfill.
3. ODDS: independently owned licensed/authorized market adapters into normalized event/market/outcome/player/line/price/quote-time identity. Do not pretend this provides 100% DraftKings coverage; expected-catalog denominator must be independently sourced.
4. EXCHANGES: Kalshi and Polymarket order books, matched settlement/rules, best *executable* bid/ask, fees, volume and size. Distinct order-book contracts cannot be arbitraged solely because their display percentages differ.
5. MODEL: versioned calibration and ensemble forecasting built from history and context; keep training/validation splits chronological; record Brier score, log loss, CLV, settled ROI and missing data.

## Data model and proof
Every market quote: provider_id, upstream_owner_id, bookmaker, sport, league, canonical_event_id, provider_event_id, event_start, market_type, period, outcome, player_id where applicable, exact line, American/decimal price, observed_at, received_at, live/delayed marker, terms/license class, amount available where available, source status.
For each signal:
- Break-even p from displayed odds; calibrated independent model p and source evidence; edge = model p - break-even p; ROI = p*(decimal_odds-1) - (1-p).
- Net arb uses *executable* available prices after fees and contract equivalence, not theoretical last-trade marks.
- Promotions are scenario-based only after terms validation and max stake; correlated SGP legs require joint probability, never product-of-marginals as if independent.
- Explicit states: VERIFIED / SINGLE_SOURCE / STALE / MISSING_PRICE / UNLICENSED / QUOTA_EXHAUSTED / UNMATCHED_RULES / UNCALIBRATED / UNAVAILABLE. None except VERIFIED implies a release-ready recommendation.

## Operational approach
Cloudflare D1 is the primary append-only provenance ledger; incremental rate-limited adapters and long-lived history are separated from fast dashboard reads. Deduplicate by canonical identity + actual source event timestamp, not refresh time alone. Maintain audit-able source registry and independent owner relationships, quota budgets, per-sport coverage and consumer health. Preview workers use isolated D1, writes and autonomous ATLAS agent execution disabled by default. Never use synthetic observations to certify a live connection or bypass quota limits.

## Acceptance sequence for next consolidated build
1. Create adapter interface and capability flags with stub-safe disabled states, contract unit tests and quota/circuit breaker behavior.
2. Build feed-independent source health board and normalized odds/props history readbacks, with event/settlement equivalence and per-league gaps.
3. Add first-party no-vig, probability edge, stake, correlation-aware SGP and Kalshi fee-adjusted order-book calculations with numerical golden tests.
4. Wire only genuinely authorized sources via staging secrets after owner approval; run bounded real read/write/readback, capture timestamps and permitted scope, then disable staging writes.
5. Host preview + browser checks, load checks, source proof/terms audit and owner-reviewed promotion. Production automation/wagering must remain disabled until certified.

## Reality check
These five products are research/feature benchmarks. No direct integration with OddsJam, Unabated, OpticOdds, Outlier Pro or BetBurger is claimed or established by this file. EdgeForce can combine equivalent analytical functions using its independently obtained data, and can optionally connect a vendor only with supported documented API and license.

## Consolidated four-stage release train (October 23, 2026)

The following are **four macro release stages**, not a promise of four commits or guaranteed completion. Each can involve multiple commits and CI reruns; do not declare a stage finished until its evidence is recorded. Keep all changes in reviewable draft PRs, with one staged release authority, no surprise production deploys or automated wagering.

### Stage 1 — Live first-party sports network and D1 evidence (current, Major C)
- Discover *authorized* providers and exact usage permissions; report credential presence and request health without revealing secret values. Distinguish odds, scores, context and exchange order books.
- Exercise soccer leagues, ATP/WTA, table tennis and major/college US sports when actually exposed by licensed sources; record per-league supported, observed, missing and unknown markets. Do not assume all DraftKings events or props can be enumerated.
- Read/write/readback **real authorized representative odds and player props** in isolated Cloudflare D1 staging. Verify event/market/player/line/time/source keys, permissions, retention, pagination, freshness and 401/422/failure paths. An empty scheduler receipt history means not exercised, never success.
- Corroborate at quote level using **two distinct upstream owners**, matching event and settlement identity; otherwise prominently label SINGLE_SOURCE/UNKNOWN.
- **Exit evidence:** provider entitlement and healthy-response snapshots, timestamped D1 readback with source attribution, denominator provenance, source health/quotas, all mandatory CI, isolated runtime audit. No live credential = stage blocked, not passed.

### Stage 2 — First-party modeling, value and arb engine
- Versioned pregame and player-prop models use independent, temporally correct inputs; avoid treating book prices as calibrated independent forecasts. Backtest by season/league with leakage checks and out-of-sample Brier/log-loss, uncertainty, model sample size and drift.
- Calculate displayed and executable prices, no-vig references, break-even %, independently modeled %, edge in percentage points, EV/ROI, stake/risk limits, market settlement compatibility, fee-adjusted arbitrage and promotion constraints.
- Validate SGP **joint** probabilities and correlations; never multiply marginal odds as if legs are independent. Don't claim 100,000-run simulation or profitable returns without executed evidence.
- **Exit evidence:** reproducible fixtures and golden math tests, calibration report, source-to-signal trace, no false +EV or arb on stale/mismatched markets.

### Stage 3 — Professional all-markets product
- Clear readable desktop/mobile navigation: Daily Top 30, Today's Top 50, Weekly Top 50, All Markets & Props, Parlays, Prediction Markets, Live Scores, Source/Research/Risk and Operations.
- All filters and leaderboards must distinguish verified, single-source, missing, stale, ineligible, uncalibrated and unavailable markets, with timestamps and denominator provenance.
- Preserve historical picks, settled outcomes, closing-line value, ROI and model version; make bankroll and boost analysis informational, never imply guaranteed profit.
- **Exit evidence:** authenticated hosted preview, real-data browser/visual QA, WCAG checks, empty/error states, contract tests and data-to-UI lineage.

### Stage 4 — Production certification and controlled release
- Verify Cloudflare CPU/subrequests/cron/quota ceilings, retry/backoff, operational alerts, cache/staleness policy, D1 migrations, backups/restore, replay, security and credential isolation.
- Verify exactly one deployment authority, immutable deployed SHA, CI required checks, staged rollout/rollback, smoke test under live-like budgets and reliable failure shutdown.
- **Exit evidence:** release matrix with dated CI/runtime evidence, owner approval, live source inventory, operational dashboard and rollback dry run; only then authorize production rollout. Autonomous wagering remains out of scope.

**Blockers are not build-count inflation:** unprovisioned/licensing-restricted feeds, incomplete DraftKings denominator, absent independent upstream, empty D1 readback, uncalibrated probabilities and unverified executable prices cannot be converted into PASS by adding code. Track them explicitly; release readiness stays blocked.
