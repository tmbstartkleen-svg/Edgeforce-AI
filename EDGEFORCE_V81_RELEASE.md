# Edgeforce V81 — Preventive Decision Outcome Calibration

V81 evaluates how well V80 gate decisions line up with later 24-hour outcomes.

## Capabilities
- links preventive decision snapshots to later same-cause incident outcomes
- evaluates RECOMMEND, HOLD_FOR_EVIDENCE, and DO_NOT_USE behavior
- calculates Brier score and weighted calibration error
- tracks decision-specific success rates
- persists calibration snapshots for trend analysis
- refreshes during normal SLO supervision
- exposes calibration quality in the System dashboard

## Guardrails
V81 is measurement and calibration only. It does not execute preventive actions or bypass release, SLO, rollback, or protective controls.
