# Edgeforce V94 — Baseline Governance Cycle Lock & Transition Journal

V94 hardens the V87–V93 lifecycle against concurrent or repeated supervision runs.

## Capabilities
- minute-bucket idempotency keys for baseline-governance cycles
- 90-second database-backed lease lock
- STARTED / COMPLETED / FAILED transition journal
- skips duplicate completed cycles
- skips overlapping cycles while another lease is active
- runs the baseline lifecycle governors under one coordinated lease
- exposes lock and cycle history in the System dashboard

## Guardrails
V94 does not change governance thresholds or promotion criteria. It only controls execution ordering, duplicate suppression, and lifecycle journaling.
