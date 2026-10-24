# Major 25 — First-party D1 sportsbook opportunity review

## Goal

Merge the previously unmerged canonical player-prop identity and line-history engine into the actual D1 Cloudflare deployment, and add a read-only query for verified opportunities. This does **not** create or fetch sportsbook odds.

### Owner route

Authenticated `GET /api/operations/sportsbook-opportunities` requires the existing stable `CRON_SECRET` and the `INTELLIGENCE_DB` binding. Returns a bounded report from up to 1,000 freshest provider-observed archived quotes (last 20 minutes). This does not consume API credits or place bets.

The review joins the approved, enabled source registry by exact `source_id` and `upstream_id`, checks that each archived row agrees with its original raw payload's event, market, bookmaker, outcome, odds and timestamp, and requires explicit 2/3-way outcomes, compatible settlement, period, line and player/stat identifiers. Without that evidence, the quote is rejected. The arb engine now partitions on the canonical line identity to prevent comparing different player thresholds as if they were the same proposition. Arbitrage is strictly theoretical, excludes exchange settlement mismatches, and is not automatically executable.

### Independent EV models

No independent calibrated forecasts are supplied by this D1 route, so `modelVerifiedEdges: []` is the only accurate result. Historical stored prices are not model-generated probabilities. A later stage must integrate out-of-sample evaluated sport-specific forecasts with their evidence and holdout scores before ranking positive EV.

### Production release and source activation

Deploy through the exact-main certified Build 24 manual D1-native workflow. Register licensed odds sources separately using Build 23's source registry with explicit ownership and approval. Source registration alone does not activate collection. The D1 sportsbook archive writes are still disabled in `wrangler.jsonc`; enable only after a bounded source-specific canary and ingestion authorization. Do not expend remaining paid quota on diagnostics.
