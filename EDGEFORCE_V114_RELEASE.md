# Edgeforce V114 — Production Remediation Continuity

V114 repairs the two production blockers exposed by V113 without weakening the production boundary.

## Verified V113 production findings

- V113 main verification passed.
- Cloudflare built and deployed the V113 artifact, but certification hit the previous V112 runtime during Worker propagation.
- The Odds API account remained quota exhausted and no persisted normalized sportsbook rows were available.
- Vercel production remained on the older V74 release.
- the V74 SLO governor correctly reported FROZEN because existing production observability was CRITICAL.
- that freeze prevented the remediation candidate from being staged at all.

## V114 repair contract

### Exact Cloudflare release convergence

Cloudflare no longer treats a generic liveness response as proof that the new Worker is active.

Before provider certification, the workflow now polls `/api/health` and requires all of the following to match the candidate:

- app version `114.0.0`
- model version `edgeforce-v114`
- exact deployment commit SHA
- release identity match

This prevents a newly completed deployment from accidentally certifying the previous Worker during propagation.

### Staged Vercel remediation

Vercel production deployment is now two-phase:

1. build the exact production artifact
2. deploy it as an isolated candidate
3. apply migrations and runtime bootstrap
4. certify providers and strict launch doctor
5. verify usable real data
6. run hosted smoke, strict release certification, SLO candidate check and canary
7. require V1 readiness
8. only then promote that exact candidate to production

A failed candidate before promotion leaves the current production alias untouched.

If the existing production SLO governor is frozen, the workflow enters explicit remediation mode instead of blocking the candidate from being staged. The freeze remains visible and the candidate must prove its own non-critical hosted health before promotion.

### FanDuel live-pulse continuity

When the primary ODDS provider is explicitly quota exhausted and no acceptable persisted normalized sportsbook slate exists, Edgeforce now evaluates the keyless FanLine Wire FanDuel pulse.

A pulse can certify operational continuity only when:

- the feed responds successfully
- the snapshot is fresh
- at least one market-update row is present
- at least one real American price is present

The resulting provider certificate is `fanlinewire-fanduel-pulse`.

This is deliberately not represented as a full normalized sportsbook slate. Full recommendation/model coverage remains degraded and protected until a complete odds provider or persisted slate returns.

### Live-data status contract

`/api/live-data/status?requireUsable=1` now recognizes three truthful real-data states:

- `live` — full live normalized odds
- `stored` — certified recent persisted real odds
- `pulse` — fresh real FanDuel operational continuity

Demo and unavailable data remain rejected in production.

### Observability behavior

A fresh FanDuel pulse can downgrade stale raw/consensus market freshness from CRITICAL to DEGRADED during a provider quota outage. It can never make those checks HEALTHY.

Database failures, failed automation, ACTION incidents and other independent critical failures remain fail-closed.

### V1 readiness

Pulse-only remediation is reported as CONDITIONAL, not fully healthy:

- live-data gate becomes warning-level continuity
- blocked unified intelligence stays protected
- protective reliability mode remains visible
- a historical SLO freeze is warning-level only when the candidate itself is non-critical in remediation mode

The system therefore stays operational for live timing and price movement without falsely claiming full sportsbook/model readiness.

## Identity

- build: V114
- app: 114.0.0
- package: 0.114.0
- model: edgeforce-v114
- migration: v114
