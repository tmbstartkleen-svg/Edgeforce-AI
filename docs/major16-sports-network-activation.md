# EdgeForce sports-network foundation — Major Build 16

## Purpose

This build extends the existing specialist registry rather than claiming that a collection of names constitutes autonomous agents. It defines bounded task planning across the registered sport domains and 10 operational lanes: schedules, odds, props, injuries, lineups, player statistics, team statistics, weather, results, history. **Agents are not yet self-running.** Existing certified collectors remain the only execution paths. A proposed plan must be separately approved and executed by an authorized scheduler and adapter.

## New protected endpoint

`POST /api/operations/sports-network-plan` requires `Authorization: Bearer <CRON_SECRET>`. It accepts `sources`, `sports`, `lanes`, `budgetCredits`, `maxJobs`, optional `observations`, and optional `candidate`. It never polls providers or writes data. Responses identify proposed collection jobs, unsupported coverage, budget reserves, independently owned upstream coverage, and conditions preventing an odds edge from becoming actionable.

Each source must declare an enabled, licensed `sourceId`, independently owned `upstreamId`, supported sports and lanes, and bounded credit cost. Missing approval, unsupported coverage, exhausted credits, source freshness windows, or disabled agents do not result in a provider call. A bookmaker supplied via one aggregator is not counted as a separate independent upstream.

## Certification and controlled future activation

1. Audit provider licenses, source identities, rate limits, and the exact sports/leagues/markets each source actually supports.
2. Register approved source adapters and persist last-collection timestamps, budgets, circuit breakers and receipt hashes in the existing D1/agent-task ledger.
3. Add operator-approved deterministic task enqueueing under the existing bounded executor (no arbitrary URLs or browser scraping); ensure deduplication and retry backoff.
4. Independently certify event/market/selection join quality, source observation time, book identity, and comparison-price freshness.
5. Promote a value signal only with a verifiably quoted target-book price, at least two independently owned upstreams, independently calibrated win probability, positive ROI and documented settlement history.
6. Run canary and production smoke with explicit quota ceilings and rollbacks before enabling schedules.

## Current blockers

The endpoint is a **planning and evidence evaluation** engine, not an activated background sports network. It does not supply paid API credentials, provider licenses, fixtures, sportsbook lines, injuries, player statistics, model calibration or verified betting edges by itself. A passing CI workflow is not evidence that the full DraftKings catalog has been collected or that profitable opportunities exist.
