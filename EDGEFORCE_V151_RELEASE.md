# Edgeforce V151 — Durable Settlement Provenance

V151 makes automated settlement evidence durable and auditable after a wager is graded.

## What changed

- Every score-fallback settlement row now carries a V151 provenance certificate with:
  - evidence class,
  - source,
  - confidence,
  - source count,
  - agreeing source count,
  - acceptance reason,
  - observed timestamp,
  - and the final score used to grade the wager.
- Provider-native result rows carry an explicit `PROVIDER_NATIVE` provenance class.
- Reconciliation persists settlement provenance into the exact `bet_legs.metadata.settlementProvenance` record.
- Persistence is idempotent: unchanged provenance does not generate duplicate metadata writes or duplicate audit events.
- Every newly applied evidence record creates a durable `RESULT_EVIDENCE_APPLIED` ledger event.
- Automatic settlement telemetry now reports provenance writes, evidence-event counts, and evidence-class distribution.
- Adds a bounded, read-only `/api/ledger/settlement-evidence` endpoint to review durable evidence history and the exact settled leg.
- Adds mandatory regression coverage plus health, smoke, and release-audit certification.

## Data model

V151 deliberately reuses the existing `bet_legs.metadata` JSONB field and `ledger_events` audit table. No database migration is needed.

## Operational policy

V150 still decides whether evidence is safe enough to settle. V151 records why that decision was accepted and preserves the evidence used for later review, calibration, or dispute investigation.

Cloudflare remains the production primary and Vercel remains a manual-only disaster-recovery standby.
