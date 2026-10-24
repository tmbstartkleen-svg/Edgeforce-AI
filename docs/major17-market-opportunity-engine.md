# EdgeForce Major 17 — multi-book opportunity engine

This release introduces a **read-only** evidence engine for theoretical arbitrage and independently modeled +EV. It does not poll sportsbooks, place wagers, or fabricate lines. The engine expects caller-provided, authorized, timestamped observations; subsequent builds must connect it to the independently certified collectors and audited historical market database.

## Audited fields

Each bookmaker observation carries `eventId`, `marketKey`, `settlementKey`, `currency`, `venueType`, `outcomeSetType`, complete ordered or unordered `outcomes`, `selection`, `bookmaker`, `providerId`, `upstreamId`, `observedAt`, `side`, and `odds` (American). Every quote must carry a valid and recent provider observation timestamp.

Potential arbitrage is considered only inside the same event, market, settlement rule, currency, venue type, and complete 2/3-way outcome set. It picks the best actual quoted odds for each mutually exclusive outcome, then computes `S = sum(1/decimal_odds)`. When S < 1, the theoretical return factor is 1/S and stakes are assigned proportional to 1/decimal_odds. At least two **different venues** must be selected. Multiple bookmakers delivered by the same aggregator are identified as a single upstream and therefore remain *unverified opportunities*.

**No cross-venue sportsbook/prediction-market arbitrage** is claimed by this module until a later settlement-contract mapping verifies exact payout terms, fees, and resolution. No automatically actionable picks, live prices, payments or historical winnings are claimed. Fees, limits, market suspension, slippage, maximum executable size and rounded stakes can eliminate theoretical arbitrage.

The value screen requires an actual eligible target-book quote, an independent model probability, out-of-sample calibration assertion, documented source audit and >=2 independent upstream owners. It calculates break-even, probability-point edge and expected ROI; the result is only a `CANDIDATE_FOR_FURTHER_REVIEW`, never a guaranteed outcome. A boolean asserted by a caller does not by itself establish those empirical conditions in production.

## Endpoint

Authenticated `POST /api/operations/market-opportunity-scan`, bearer `CRON_SECRET`, with `{quotes:[],forecasts:[],bankroll:100}`. Bound sizes: 10,000 quote records, 5,000 forecast records. Returns read-only opportunity analysis, no market requests or database writes. `bankroll` is hypothetical sizing, not a staking recommendation.

## Remaining release requirements

1. Fix and merge the previously failing Build 15 production-ingestion smoke check.
2. Join stored quotations with unique event/market/line/selection/settlement evidence, canonical provider timestamps and independent operator identities.
3. Wire audited source observations into the engine with explicit licensing, cross-provider throttles, change receipts and quota budgets.
4. Add sport-specific independent model pipelines with observed features, walk-forward backtests, and calibration monitoring.
5. Add complete audited 2/3-way settlement mapping and executable-bet size, fees, accepted wager price or exchange fill confirmation.
6. Confirm deployment and end-to-end market coverage with live data before release certification.
