# Edgeforce V135 — Legacy SLO Remediation Handoff

V135 repairs the final handoff between a healthy pre-V74 production release and the modern V119 staged release pipeline.

A pre-V74 production target has no compatible SLO history. After the replacement candidate passes exact provider certification, launch doctor, hosted smoke, release attestation, and strict production certification, V135 allows a frozen shared-history SLO report to advance only to the existing comparative canary. This exception requires all three explicit workflow proofs: remediation mode, verified legacy handoff, and successful strict candidate certification.

Normal remediation deployments still fail closed when current observability is CRITICAL. Comparative canary, strict V1 readiness, production-alias recheck, promotion, and post-promotion verification remain mandatory.
