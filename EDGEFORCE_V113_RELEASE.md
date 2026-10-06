# Edgeforce V113 — High-Speed Provider Transport

V113 turns the V112 multi-source feeds into a faster production transport layer. The goal is not to poll every upstream service as fast as possible; it is to minimize latency while collapsing duplicate requests, respecting free-tier limits, and always preferring the freshest valid real-data source.

## Transport upgrades

### Request coalescing

Concurrent dashboard/API requests now share in-flight upstream work instead of opening duplicate provider connections.

- odds-panel requests use a shared short cache and one in-flight promise
- FanDuel keyless pulse requests share one 10-second-floor request
- live-score sources coalesce concurrent requests independently by source/league
- bounded stale-if-error continuity avoids unnecessary blank states during short provider/network failures

### Adaptive live game-state cadence

League-native feeds and ESPN fallback feeds now have separate live and idle refresh clocks.

Defaults:

- MLB/NHL league-native while live: 2 seconds
- MLB/NHL league-native while idle: 15 seconds
- ESPN broad fallback while live: 5 seconds
- ESPN broad fallback while idle: 30 seconds
- stale-if-error continuity: 120 seconds
- browser board refresh: 1 second

The browser can therefore repaint every second without generating one upstream request per browser per second.

### Adaptive full-odds refresh

Persisted real odds no longer suppress live provider refresh indefinitely.

EdgeForce now determines the next provider pull from the fastest configured source class:

- generic fast ODDS provider: 15-second default
- SportsGameOdds: its configured cache window, default 5 minutes
- The Odds API only: its quota-protecting cache window, default 10 minutes
- explicit `ODDS_LIVE_REFRESH_MS` overrides the automatic policy

Fresh stored rows are still served between provider pulls, but once the source-specific refresh window expires EdgeForce attempts a live provider refresh automatically.

### Latency + freshness scoring

Provider consensus now includes transport quality:

- payload quality
- provider health
- network latency
- payload freshness

Lower-latency, fresher providers receive more effective consensus weight while slower providers remain available as redundancy.

## SportsGameOdds adapter

V113 adds a native optional SportsGameOdds REST adapter.

Configuration:

- `SPORTS_GAME_ODDS_API_KEY`
- `SPORTS_GAME_ODDS_BASE_URL`
- `SPORTS_GAME_ODDS_LEAGUES`
- `SPORTS_GAME_ODDS_CACHE_MS`
- `SPORTS_GAME_ODDS_TIMEOUT_MS`
- `SPORTS_GAME_ODDS_PRIORITY`
- `SPORTS_GAME_ODDS_CONSENSUS_WEIGHT`

The adapter uses the documented `x-api-key` header and `/v2/events/` endpoint, requests multiple leagues in one call, normalizes per-bookmaker prices, and participates in the existing EdgeForce quality/circuit-breaker/consensus pipeline.

No API key is committed to the repository.

## Diagnostics

New route:

`/api/network/transport`

It exposes non-secret operational information including:

- configured odds-provider count and priority
- provider transport type
- live-score source refresh cadences
- request coalescing state
- FanDuel pulse freshness/latency
- score-mesh cache state

The dashboard also shows the fastest accepted odds-provider latency.

## Safety and quota controls

V113 does not bypass provider authentication, rate limits, or commercial restrictions.

Free/slow feeds remain backups at their supported cadence. Faster paid or licensed feeds can be added through the same provider slots without redesigning the application.

## Identity

- build: V113
- app: 113.0.0
- package: 0.113.0
- model: edgeforce-v113
- migration: v114 (unchanged)
