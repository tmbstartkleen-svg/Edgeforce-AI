# Edgeforce V91 — Post-Handoff Successor Validation & Safe Reversion

V91 validates a V90 SUCCESSION_CHAMPION after promotion.

## Capabilities
- compares post-handoff calibration and Brier performance to the promoted successor baseline
- requires three consecutive healthy windows to confirm the successor
- keeps immature evidence in VALIDATING state
- automatically revokes a succession champion on material degradation
- reopens V89 succession and returns baseline selection to the safe fallback path after reversion
- persists validation and reversion history
- exposes validation state in the System dashboard

## Guardrails
V91 only supervises succession champions. It does not revoke FULL_PROBATION_CHAMPION baselines and cannot increase adaptive influence.
