# Edgeforce V116 — Continuity Readiness + Schema Closure

V116 closes the production inconsistencies exposed by V115 after staged deployment and prediction-intelligence priming both advanced successfully.

## Verified V115 findings

Cloudflare successfully:
- deployed exact V115
- certified the fresh real FanDuel pulse
- verified usable sportsbook continuity
- passed prediction-terminal and PWA checks
- completed prediction-intelligence warehouse priming

The prediction warehouse remained degraded only because an older database retained a required `provider` column on `prediction_market_snapshots`.

Cloudflare then failed strict launch readiness because the readiness layer counted only non-quarantined configured ODDS providers and did not recognize the already-certified real-data continuity provider.

Vercel successfully:
- built a preview-target staged remediation artifact
- deployed the candidate without the prior prebuilt target mismatch
- applied runtime migrations
- certified provider continuity
- reached hosted smoke

The hosted smoke then failed because the expert-model endpoint correctly protected recommendations while no full normalized sportsbook slate was available, but the smoke script still required an active expert recommendation response.

## V116 repair contract

### Fresh certified continuity in strict readiness

Strict readiness now recognizes certified quota continuity only when all of the following are true:

- the certification belongs to the current release
- the provider certification is launch-ready
- the continuity provider is `fanlinewire-fanduel-pulse` or `persisted-live-odds`
- the continuity provider is certified for ODDS
- payload age is inside that provider's maximum age
- the certification check itself is still inside the same freshness window

This does not mark the full configured provider healthy. The configured provider may remain quarantined while continuity is explicitly disclosed.

### Protected expert-model smoke state

Hosted smoke now accepts the expert-model endpoint's intentional protected response when no complete normalized sportsbook slate exists.

It still requires:
- the V61 expert-model schema
- the expert catalog
- either an active expert-model response or the exact protected no-full-slate condition

This prevents pulse-only continuity from being misrepresented as full recommendation capability.

### Legacy prediction snapshot compatibility

Migration v115 closes the remaining legacy schema collision.

If an older `prediction_market_snapshots.provider` column exists:
- missing provider values are backfilled from venue when possible
- the column receives a safe default of `edgeforce-prediction`

Canonical V40 inserts can then persist snapshots without violating the older NOT NULL contract.

### Strict launch-doctor truth

Both Vercel and Cloudflare now parse the launch-doctor payload and explicitly require:

- `ok=true`
- `ready=true`
- zero blockers

A transport command returning JSON is no longer enough to mark the gate passed.

### Stable Cloudflare release identity

Cloudflare production now requires three consecutive exact release-identity confirmations before certification begins.

Provider certification and live-data verification must also report:
- version 116.0.0
- model edgeforce-v116

This prevents mixed old/new Worker propagation from contaminating certification evidence.

## Identity

- build: V116
- app: 116.0.0
- package: 0.116.0
- model: edgeforce-v116
- migration: v115
