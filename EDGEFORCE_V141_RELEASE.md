# Edgeforce V141 — Recovery Timeline, Alerts, Decision History, and Manual Controls

V141 turns the V140 governor dashboard into an operational release-control surface.

The telemetry now exposes a recovery timeline instead of only one predicted normal-capacity time. It identifies the next deployment expiration, the point where the hard-cap restriction clears, intermediate recovery checkpoints, and the point where normal automated capacity resumes.

Governor decisions become durable in Postgres. Every stored governor snapshot records each governed project's state, reason, pending status, active deployment count, cooldown state, and shared budget context. Threshold and project-state alerts are synchronized into a durable alert table so capacity recovery, reserve entry, hard-cap pressure, and project deferrals are visible historically without creating duplicate alerts on every dashboard poll.

V141 also adds a dedicated manual release workflow. The workflow requires a project, release tier, and written justification. Normal releases remain blocked at 84 deployments. Emergency releases may consume the six-slot reserve only while usage is below the hard cap of 90. At or above 90, all manual releases fail closed. Edgeforce manual releases reuse the existing guarded production workflow; Safeguard and TravAI use their governed linked-Git release path.

The public dashboard remains read-only. It shows manual release availability and links operators to the reviewed GitHub Actions control instead of exposing a production deployment action to unauthenticated browser users.
