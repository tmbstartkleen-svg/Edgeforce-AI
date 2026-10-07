# Edgeforce V136 — Legacy Canary Telemetry Handoff

V136 repairs comparative canary evaluation when the live production baseline predates the modern observability and reliability APIs.

The production workflow now records whether baseline observability/reliability telemetry was actually unavailable instead of substituting zero values that look healthy. The deployment guard may treat those specific fields as unknown only during an explicitly verified pre-V74 legacy handoff.

The exception remains bounded: the candidate must match the current release, be ready and production-ready, already hold a successful current production certification, and retain fresh real pulse continuity. Market freshness still has an absolute ceiling. Modern production baselines continue to compare ACTION incidents, critical checks, automation failures, observability score, and reliability score normally.

This change does not promote the candidate by itself. Comparative canary repetition, strict V1 readiness, alias recheck, promotion, and post-promotion verification remain mandatory.
