# Edgeforce V86 — Probation Performance Monitor & Stage Rollback

V86 evaluates each V85 probation stage against the recovery baseline.

## Capabilities
- compares calibration error and Brier score to the re-entry baseline
- classifies probation performance as STABLE, HOLD, or ROLLBACK
- automatically rolls back one probation stage on material degradation
- preserves the recovery lock and bounded threshold framework
- persists performance and rollback history
- exposes degradation score and rollback status in the System dashboard

## Guardrails
V86 can only reduce probation-stage influence. It cannot increase adaptive influence beyond V85 rules and cannot execute operational preventive actions.
