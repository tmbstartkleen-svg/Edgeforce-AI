# Edgeforce V101 — Rollback Evidence Reconciliation

V101 closes the rollback-evidence gap left after production rollback.

## Capabilities
- records durable rollback reconciliation events
- marks the failed release promotion provenance as rolled back
- invalidates the failed commit's post-promotion verification certificate
- records the restored deployment identity and workflow run
- exposes rollback state in System view
- makes a confirmed rollback a strict blocker for the failed release
- adds regression, smoke, and release-audit coverage

V101 does not change prediction models, betting thresholds, bankroll logic, market selection, or recommendation policy.
