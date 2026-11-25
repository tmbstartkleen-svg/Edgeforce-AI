# V198 — observed sportsbook recovery and credit protection

V198 repairs a real price-discovery failure: ESPN's current scoreboards supply DraftKings prices in nested `moneyline`, `pointSpread` and `total` close contracts, while the previous adapter only read legacy fields. A captured November 25, 2026 NBA response contains nine scheduled events and 54 complete reference selections. The captured schema is a regression fixture; its prices are never served as production data.

## Visible sportsbook observations

The main dashboard now shows an Observed Odds section with named sportsbook selections, event start times in America/New_York, the quoted American price and the price-derived break-even probability. Sport and market filters and progressive row display operate locally. FanLine Wire's partial FanDuel-labelled tape is shown separately using its actual selection identifiers; missing outcome names and start times are not inferred.

The score service already downloads the ESPN scoreboards. V198 extracts reference prices from those same responses and adds no discovery requests or polling schedules. The existing bounded odds adapter also understands the modern schema and processes selected scoreboards before optional Core requests can exhaust the shared request budget.

Current modern contracts take precedence over legacy data. Missing current sides never borrow opening prices or values from a different contract. Spread sides must have opposite lines, including legitimate zero spreads; over and under must share a threshold. Missing, malformed, started or non-pregame events are withheld. Moneylines with an unknown or three-way outcome set are not reduced to two sides.

## Evidence separation

These rows carry `OBSERVED_REFERENCE`. The observation time records when the feed was retrieved. It is never substituted for the bookmaker's unavailable update time. Reference observations expire after five minutes or when the event starts. Cache hits retain their original observation times.

Reference rows do not enter the certified odds count, market consensus, de-vig probability calculations, simulations, stored betting-market snapshots or the Intelligence Core odds mirror. The public reference projection contains no model probability, EV, confidence, staking or consensus fields. Fresh reference observations cannot make an accompanying stale market eligible or certified.

Identity includes sport, league, provider, bookmaker, event, selection, market and schedule. Duplicate copies collapse. Conflicting latest prices are withheld, including after separate cached snapshots are merged; a later unambiguous observation can supersede that conflict. Coverage remains explicitly partial and is capped at 200 returned reference selections.

## Provider credit protection

The Odds API's free sports catalog is now checked before any paid odds request. Its remaining-credit header must be a valid nonnegative integer. Every bootstrap, baseline fallback and sport expansion must fit above the configured reserve, using the documented market/region or bookmaker-group request cost. Missing quota evidence stops paid requests. At two remaining credits and the default reserve of 25, no paid request is made.

Credentials use the documented `x-api-key` header and are redacted from diagnostics. Identical concurrent requests coalesce; caches are scoped to provider/account/configuration, and different configurations for one account serialize within the same runtime isolate. Requests stop before the existing panel deadline, and HTTP 429 does not trigger an immediate retry. Cached responses become explicitly unavailable after their freshness limit without accelerating the paid refresh cadence.

This is an in-process credit guard, not a distributed reservation across all Cloudflare isolates or external uses of the same key. It cannot restore exhausted credits or create another independent source. Provider reference: [The Odds API v4 documentation](https://the-odds-api.com/liveapi/guides/v4/).

## Pulse and stale-screen integrity

One shared pulse evaluator requires actual finite American prices, OPEN market status, valid zoned source timestamps on both snapshot and row, and ages no greater than two minutes. Future, missing, stale, suspended or malformed observations cannot contribute to usable-price counts. Certification, live-data status, readiness, observability and the dashboard use the same evaluator. Forced pulse refreshes coalesce and respect the existing ten-second public endpoint minimum interval.

The dashboard advances evidence age locally and removes current recommendation displays after a board request fails or its snapshot expires. Retained reference observations retain their original times and disclose the failed refresh. Provider attempt details expose quota and availability reasons instead of implying that an empty board is merely warming up.

## Verification and deployment boundary

The mandatory `test:odds-recovery` gate covers the captured ESPN schema, quota preflight and reserve behavior, mixed-evidence isolation, conflict suppression across cached snapshots, source-age expiry, pulse validation and dashboard rendering. The score-service integration test proves that all 54 fixture selections are recovered from the existing score requests without an additional odds request or cache timestamp reset.

Hosted smoke verification also checks the observed-odds response boundary and records actual reference counts, sports, bookmakers and source-time availability. An empty reference snapshot is reported honestly; this code release does not guarantee a complete live slate.

Local release verification passed 616 core regression tests, 66 odds-recovery tests, 80 research-pipeline tests, TypeScript, the production Next build, migration validation and the release audit. Lint reported zero errors and 19 existing warnings. The production-server smoke suite passed 51 checks; the 60-request load check had zero failures and a 151 ms p95. A live public-scoreboard probe through that local production server returned the configured cap of 200 DraftKings reference selections across NBA, NCAAB, NFL, NHL and UCL. None supplied a bookmaker update timestamp; recommendation authorization remained false. These observations are a point-in-time coverage check, not betting-performance evidence.

Cloudflare remains the automatic production primary and Vercel the manual standby. Credentials, paid plans, schemas, collector schedules and betting authorization are unchanged. V198 is a feature milestone; runtime version remains `119.0.0` / `edgeforce-v119`. Platform deployment completion does not establish independently validated model edges or authorize orders.
