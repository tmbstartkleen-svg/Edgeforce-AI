# Shared sports research pipeline

Part of consolidation #506; extends the player-research work in #507. The pure
`buildSportsResearchPipeline` function connects supplied market observations,
the PULSE scenario gate from #500, and the existing player-history evidence gate.
It makes no provider requests, database writes, model training runs or wagers.

## Read-only analysis route

`POST /api/operations/market-opportunity-scan` requires the server-side
`CRON_SECRET` bearer credential, with at least 32 characters. The body supports
`quotes`, optional `forecasts`, optional `playerResearch`, and the existing
arbitrage `bankroll` input. The streamed body is limited to 4 MiB. Bounds are
10,000 quotes, 5,000 forecasts and 100 player-research bundles.

The existing `arbitrage` and `value` arithmetic remain in the response. The new
`research` record is the full scenario/history review gate. Legacy value
calculations do not replace the research record's blockers. All supplied source,
calibration and lineup assertions remain unauthenticated. The route cannot
enable collection or authorize a bet through request-body flags.

## Matching and evidence

| Evidence | Required identity or metadata |
| --- | --- |
| Quote/model join | Exact canonical market identity, sport, selection, currency, side and exhaustive outcome set |
| Canonical market | Event, market and settlement rules; player, statistic, line and period for derivatives |
| Quote | Bookmaker, provider, upstream owner, source observation time and valid American odds |
| Market state | Explicit open market; upcoming/live event with consistent start time |
| Model | ID/version, generation time, earlier training cutoff, input references, holdout and calibration references |
| PULSE | At least two valid weighted scenarios, calibration/holdout assertions and availability status/references |
| Player prop history | Same player, sport, stat and numeric lineValue; completed, sourced game history as of no later than model generation |

Model records repeat the quote's contract fields. Identity fields are never
inferred from a team name or attached to a different line. `eventStartsAt`,
`generatedAt`, `trainingCutoff`, player `asOf`, and history timestamps use ISO
strings. Quote `observedAt` is epoch milliseconds. `marketStatus` must be `OPEN`;
`eventStatus` must be `UPCOMING` or `LIVE`. Live quote age is capped at 15 seconds
in this gate; other quotes/models use the configured maximum age (20 minutes by
default). Future source quote timestamps block review.

Each player-research bundle uses the existing `buildPlayerResearchSnapshot`
contract: playerId, sport, games, stat, threshold, and asOf. A prop quote also
needs explicit numeric `lineValue`; this is compared with the research threshold,
while `lineKey` remains the exact market join key. Historical hit rates are
reported separately and never converted into forecast probabilities.

The record preserves quote/model references, break-even probability, scenario
dispersion, conservative probability, edge and expected return, player history,
and rejection reasons. PULSE probabilities, edge and ROI are fractions; multiply
by 100 for percentages. Legacy `value.expectedRoi` is already a percentage and
`value.edgePercentagePoints` is in percentage points.

Missing or conflicting evidence yields `RESEARCH_ONLY`. Complete supplied
evidence can yield `CANDIDATE_REQUIRES_INDEPENDENT_VERIFICATION`; this is not a
source-authenticated forecast or a recommended wager. Source authentication and
bet authorization remain false, and slip/settlement references remain null.
The implementation does not create a calibrated model or establish live
coverage. Connecting verified persisted forecasts is still required.

## Provider integration boundary

The #499 localhost gateway is available through `npm run serve:free-sports`,
with upstream collection disabled by default. It is not mounted in the production
Worker. Its per-process limiter must be replaced with shared durable quota state
before production collection. Consensus prices must not be promoted into
executable sportsbook quotes or independent forecasts.

## Verification

`npm run test:research-pipeline` covers provider opt-in, cooldown/cache behavior,
source and contract mismatches, player evidence, stale/closed/live markets,
scenario arithmetic, authorization and streamed payload bounds. It runs from
`posttypecheck`, so the existing GitHub verification job includes it. Synthetic
fixture names, references and model outputs are test data only.
