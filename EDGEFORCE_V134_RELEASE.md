# Edgeforce V134 — Legacy Remediation Handoff

V134 connects the existing staged-remediation release path to legacy production baselines that predate the SLO governor.

## What changed

- A healthy pre-V74 production release that lacks the modern SLO governor now stages its replacement with `EDGEFORCE_REMEDIATION_DEPLOY=true`.
- Legacy health, readiness, and observability checks remain fail-closed before remediation mode is enabled.
- Modern production releases with an unavailable SLO governor still fail closed.
- Strict final certification, candidate SLO acceptance, comparative canary, V1 readiness, alias recheck, and promotion remain mandatory.

## Why

The live Edgeforce production baseline is v23.0.0. Its health fallback passes, but it has no modern SLO governor or observability contract. V132 added bounded remediation certification, yet the workflow never enabled remediation mode for this legacy handoff. V134 fixes that wiring without bypassing the later safety gates.
