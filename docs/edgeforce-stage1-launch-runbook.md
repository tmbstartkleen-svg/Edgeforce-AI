# EdgeForce launch gate: authenticated sportsbook odds

Updated 2026-10-23. This is an operational gate, **not a release approval**.

## Observed read-only environment baseline

- Cloudflare Workers: `edgeforce-ai`, `edgeforce-ai-cert-staging`, `edgeforce-d1-pilot`.
- D1: `edgeforce-d1-pilot-isolated`, `edgeforce-intelligence-staging`, `edgeforce-intelligence`.
- Isolated pilot: 17 registered sources (16 enabled ESPN scoreboard, one disabled certification-only); **0 odds observations**.
- Production: one disabled certification-only source; **0 enabled odds sources, 0 odds observations**.
- The production Worker last reported modification on 2026-10-19. A passing hosted-preview CI does not prove production deployment.
- The prior The Odds API live probe returned 19 DraftKings h2h quotes over seven events in one authorized call. It does not establish ongoing ingestion, player props, data retention permission, independent feed ownership, or live quote freshness.

These are point-in-time findings, not guarantees. Recheck before making release decisions.

## Non-negotiable Stage 1 sequence

1. Obtain and preserve provider licensing / source-use and storage rights, including the permitted markets, domains, D1 retention, caching, request budgets and expiry. A user-owned API key alone is not permission to retain sportsbook odds.
2. Confirm the key is held as a secret, never placed in GitHub, logs, client components or uploaded files. Require explicit approval before any metered request.
3. Identify independently **operated upstream owners**: DraftKings and FanDuel quotes inside one aggregator are still **one upstream**. ESPN scoreboards and match scores are **not sportsbook odds**.
4. In a separate isolated D1 pilot, register only explicitly approved sportsbook odds source types. Never reuse the 16 scoreboard source IDs. Run `npm run stage1:source-audit -- registry-summary.json` on a read-only evidence export.
5. Use `npm run odds:preflight -- authorized-provider-export.json` for a local dry run, preserving native event IDs, exact bookmaker, event, market, player identity, alternate line, quote timestamp and source. Player names are **not** authenticated athlete IDs.
6. After explicit permission to write and proof of storage rights, submit a bounded (at most 25 rows) authenticated pilot batch, then reconcile exact D1 readback: event, market, outcome, line, bookmaker, source, timestamp, price and payload hash.
7. Independently repeat with a genuinely distinct upstream owner, validate aligned event/outcome/line prices, measure source failures and stale quote rejection. Do not promote this evidence from research unless independently audited.
8. Only then consider model input quality, independent calibrated probabilities, price break-even, EV, settlement audit, full sport/prop coverage and Stage 4 production verification.

## Release blocking rules

- If no enabled sportsbook-odds source exists, odds ingestion remains **BLOCKED**.
- If no odds observations exist, live odds evidence remains **BLOCKED**.
- An enabled source registry row alone cannot authorize data storage or overcome the writer's explicit source-type check.
- If sportsbook/athlete IDs are provisional, do not classify player props as verified.
- If source rights, independent upstreams, matching prices, independent held-out model calibration or deployment certification are missing, **zero verified +EV signals and zero alerts**.
- Provider quotas are respected. No scheduled or repeated paid calls without budget approval; no production D1 writes before authorization.
- Merging a PR or green GitHub Actions is **not** a sportsbook data certification.

## Available operator tools

- League Coverage Dashboard: local-only Coverage Studio for authorized `{events,expected,roster,snapshots}` exports. Data is processed within the current browser tab without upload.
- `npm run stage1:source-audit -- registry-summary.json`: review registered source types versus actual odds counts; no network/database actions.
- `npm run dk:full-export-audit -- export.json`: research-only expected-vs-priced coverage, not a full DK catalog assertion.
- `npm run dk:player-identity-audit -- authorized-export.json`: non-authoritative athlete name matching.
- `npm run release:evidence-gate -- release-evidence.json`: four-stage evidence blockers. This tool does not issue approval even when research metrics are present.

**Current gate: BLOCKED.** Authorization, independent sportsbook upstreams, real D1 quote readback, model certification and production acceptance still require externally sourced evidence and explicit actions.
