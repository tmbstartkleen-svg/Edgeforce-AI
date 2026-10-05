# Edgeforce V80 — Preventive Action Decision Gate

V80 converts V79 safeguard ranking into an evidence-gated operator decision.

## Capabilities
- evaluates the top-ranked safeguard against current risk, learned effectiveness, confidence, and production health
- returns RECOMMEND, HOLD_FOR_EVIDENCE, DO_NOT_USE, or NO_ACTION
- reduces recommendation strength when current system health is critical
- persists decision snapshots for audit and calibration
- refreshes automatically with production supervision
- surfaces the gate decision in the System dashboard

## Guardrails
V80 is advisory only. It does not apply production changes or bypass release, SLO, rollback, or protective-mode controls.
