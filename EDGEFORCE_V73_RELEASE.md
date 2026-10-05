# Edgeforce V73 — Comparative Canary Deployment & Automatic Rollback Guard

V73 makes production deployment acceptance comparative rather than absolute.

## Canary baseline
Before a new artifact is deployed, the production workflow captures the last production deployment's readiness, observability, reliability, automation, incident and freshness state.

## Candidate gate
After migration, provider certification, smoke, attestation and strict certification, the new release is probed three times against that baseline.

Immediate hard rollback conditions include:
- current certification missing or failed
- readiness false
- CRITICAL observability
- PROTECTIVE reliability mode
- new ACTION incidents
- wrong release identity

Comparative rollback conditions include material regressions in observability, reliability, critical checks, automation health or data freshness.

Two of three probes must pass unless a hard blocker aborts immediately.
