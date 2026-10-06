# Edgeforce V112 — Quota-Resilient Provider Certification

V112 addresses the production blocker exposed by V111 after both hosting platforms reached real provider certification.

## Verified V111 production findings

- main verification passed.
- Vercel deployed the V111 artifact, completed runtime bootstrap and migrations, then reached provider certification.
- Cloudflare deployed the V111 Worker and also reached provider certification.
- both paths failed for the same external reason: The Odds API returned HTTP 401 because the account usage quota was exhausted.
- the provider reported 499 requests used with only 1 remaining credit.
- Vercel correctly recorded the failed launch and rolled back.

## V112 repair contract

### Quota-specific degraded certification

When and only when the required ODDS provider fails with explicit quota/credit exhaustion evidence:

- load persisted sportsbook market snapshots that were originally collected from real providers
- require the stored rows to be within the configured freshness ceiling
- run the normal market-batch quality audit
- reject the fallback when the batch is REJECT, has blockers, or has no current markets
- record a separate `persisted-live-odds` certification entry
- mark the launch as explicitly degraded rather than pretending the stored data is live

Ordinary provider failures, malformed feeds, stale snapshots, empty stored data, and demo data still fail the required ODDS capability.

### Strict production certification

Strict production certification now accepts stored sportsbook rows only when the current provider certification contains the explicit certified quota-fallback evidence. The resulting certification carries a warning that live provider quota is exhausted and production is operating from persisted real sportsbook data.

### Deployment verification

The production workflows now verify `requireUsable=1&maxStoredAgeMin=90` instead of incorrectly requiring a fresh paid API call during a known quota outage.

The endpoint still fails when neither live nor recent stored real data is available. Demo data remains disabled in production.

## Identity

- build: V112
- app: 112.0.0
- package: 0.112.0
- model: edgeforce-v112
- migration: v114 (unchanged)


## High-speed live game-state mesh

V112 also separates live game timing from betting-odds quota.

EdgeForce now combines:

- NHL league-native public web score/game-state data
- MLB public Stats API schedules/linescore state
- ESPN public scoreboard coverage as a broad fallback for NFL, NCAAF, NBA, WNBA, NCAAB, MLB, NHL, MLS, EPL, UFC, ATP and WTA

The dashboard exposes a dedicated live score/clock surface and the same game-state mesh is embedded in the one-second live-board response. The upstream game-state layer is cached independently from odds, with a default 5-second source cache, so odds-provider quota exhaustion cannot freeze score, period, inning or clock updates.

These no-key web feeds are treated as operational fallbacks rather than guaranteed licensed commercial feeds; provider-specific terms and availability still apply.


## GitHub/API feed research and FanDuel pulse

Repository and provider research found three distinct categories:

- production-friendly documented aggregators with keys and published limits
- keyless public snapshots suitable as supplemental pulses
- unofficial direct-book adapters that depend on private/internal sportsbook endpoints or TLS impersonation

V112 adopts the safest useful free addition: the FanLine Wire keyless FanDuel snapshot. EdgeForce polls it no faster than the documented 10-second floor, tracks sequence/freshness/latency, exposes it at `/api/odds-pulse`, and embeds pulse health into the one-second dashboard response.

The pulse is deliberately supplemental. It does not replace a complete bookmaker board and it cannot make stored odds appear live. Failure or staleness is disclosed and falls back cleanly.

Additional keyed feeds can be layered through the existing provider failover slots. SportsGameOdds is a strong redundancy candidate for DraftKings/FanDuel and broad book coverage, but its free tier is intentionally slow and should not be treated as a high-frequency live source. Faster WebSocket/SSE products are paid tiers and can be added without changing the EdgeForce model contract.
