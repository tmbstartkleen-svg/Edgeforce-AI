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
