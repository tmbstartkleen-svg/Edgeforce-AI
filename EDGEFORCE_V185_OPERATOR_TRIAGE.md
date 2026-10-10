# EdgeForce V185 — Operator Triage Ribbon

V185 consolidates the robustness work into one operator decision surface before deployment/testing handoff.

The ribbon shows:
- robust rows,
- review-queue rows,
- materially downgraded rows,
- validated +EV count,
- immediate actionable signals,
- provider/automation operational flags.

It also provides one-click local views for review, robust-only, downgraded, and reset.

The ribbon reuses existing client-side state, adds zero provider/network requests, and does not change qualification gates or Cloudflare-primary / Vercel-standby topology.
