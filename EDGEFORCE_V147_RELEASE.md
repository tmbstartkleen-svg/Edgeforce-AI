# Edgeforce V147 — Live Score Freshness Governor

V147 hardens the high-speed sports-data path after V146 closed production topology.

## What changed

- Preserves ESPN CDN live-game upgrades through final score-mesh aggregation instead of dropping them after enrichment.
- Reduces the league-native and ESPN CDN live cache floor to 750 ms in production.
- Reconciles duplicate games by source trust, score/clock completeness, status quality, and observation freshness instead of fixed merge order.
- Adds a live freshness state machine: `IDLE`, `FAST`, `HEALTHY`, `DEGRADED`, and `STALE`.
- Returns live-game clock coverage, score coverage, stale-game count, selected-source mix, maximum live observation age, and a recommended UI refresh cadence.
- Moves the dashboard from a fixed one-second interval to bounded adaptive polling (500 ms–5 s) with one request in flight at a time.
- Adds Cloudflare production cadence variables plus deterministic regression, health, smoke, and release-audit coverage.

## Production safety

V147 does not change the V146 release topology. Cloudflare remains the production primary and Vercel remains a healthy manual-only disaster-recovery standby. No automatic Vercel promotion is added.

The live-data path remains free-first and fail-soft. Faster polling only changes cadence and source selection; it does not weaken existing real-data-only recommendation gates or fabricate missing scores.
