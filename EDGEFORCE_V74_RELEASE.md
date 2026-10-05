# Edgeforce V74 — SLO Error-Budget Governor & Deployment Freeze

V74 converts EdgeForce operational health into a release-governance control.

## SLO windows
The governor evaluates 1-hour, 24-hour and 7-day health windows against a configurable availability target (default 99%).

Health snapshots consume budget using weighted operational severity:
- HEALTHY: no budget consumption
- DEGRADED: small budget consumption
- UNKNOWN: moderate budget consumption
- CRITICAL or ACTION incidents: full budget consumption

## Deployment freeze
Production promotion is frozen when:
- current observability is CRITICAL
- unresolved ACTION incidents exist
- 1-hour burn reaches 8x with sufficient evidence
- 24-hour burn reaches 4x with sufficient evidence
- the 7-day error budget is exhausted

## Recovery
A frozen deployment gate does not reopen immediately. Recovery requires:
1. sufficient 1-hour evidence
2. burn below 2x
3. no CRITICAL current health
4. no ACTION incidents
5. three consecutive safe governor checks

## CI/CD
Future production deployments query the currently running production governor before building the new artifact. FROZEN or RECOVERING state blocks deployment before production is changed. V74 itself allows a one-time bootstrap fallback because V73 does not expose the governor endpoint yet.
