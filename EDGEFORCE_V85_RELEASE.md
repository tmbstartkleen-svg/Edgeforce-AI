# Edgeforce V85 — Re-entry Probation & Staged Adaptive Rollout

V85 adds a probation layer after V84 recovery.

## Capabilities
- staged adaptive influence at 25%, 50%, 75%, then 100%
- requires sustained healthy evidence before each stage advance
- reverts adaptive influence to zero on calibration or stability regression
- persists probation state and history
- exposes rollout stage and influence in the System dashboard

## Guardrails
V85 only stages bounded threshold influence. It does not disable the decision gate or execute operational preventive actions.
