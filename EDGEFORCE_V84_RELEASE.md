# Edgeforce V84 — Safe Threshold Recovery & Adaptive Re-entry

V84 governs recovery after a V83 threshold rollback.

## Capabilities
- locks adaptive threshold tuning after rollback or severe instability
- evaluates recovery using instability, calibration error, Brier score, and sample maturity
- requires three consecutive healthy recovery windows before re-entry
- returns to LOCKED immediately if recovery evidence regresses
- persists recovery state and history
- exposes recovery streak and re-entry state in the System dashboard

## Guardrails
V84 only controls whether bounded threshold tuning may resume. It never disables the decision gate and never executes operational preventive actions.
