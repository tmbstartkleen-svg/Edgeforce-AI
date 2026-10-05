# Edgeforce V99 — Production Promotion Provenance

V99 adds a durable production promotion ledger so release approval and deployed identity remain linked after CI completes.

## Capabilities
- records the exact release, model, migration and commit identity promoted to production
- records deployment platform, URL, workflow run and attempt
- requires execution certification, strict production certification, comparative canary and V1 readiness before a promotion record can be certified
- exposes current and latest promotion provenance through an API and the System dashboard
- makes an existing current-release provenance mismatch fail closed during production certification
- adds regression coverage and release-audit checks for promotion provenance

## Promotion semantics
A missing V99 provenance record is warning-level during the first V99 deployment so the workflow can bootstrap its own record. Once a current-release record exists, a deployed-commit mismatch is a release blocker.

V99 does not alter prediction thresholds, bankroll logic, market selection, betting recommendations or model-promotion criteria.
