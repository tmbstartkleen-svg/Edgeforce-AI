# Edgeforce V87 — Champion Baseline Governor

V87 refreshes the probation comparison baseline only after a fully successful staged rollout.

## Capabilities
- promotes a new champion baseline only from FULL probation state
- requires STABLE performance, low degradation, mature sample size, and healthy calibration
- persists champion baseline state and promotion history
- prevents stale recovery baselines from dominating future V86 comparisons
- exposes active champion baseline metrics in the System dashboard

## Guardrails
Baseline promotion is evidence-gated and can only occur after V85/V86 complete successfully. It does not increase adaptive influence by itself.
