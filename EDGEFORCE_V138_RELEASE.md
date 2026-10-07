# Edgeforce V138 — Clean Vercel Budget Deferral and Retry

V138 turns the team-wide Vercel deployment budget guard into a release-control primitive instead of a late workflow failure.

The production workflow now starts with a lightweight `budget-preflight` job. When the shared team has reached the 90-deployment safety threshold in the trailing 24 hours, the workflow records a deferred release and skips the expensive checkout, dependency install, test, build, and Vercel upload path. The existing in-job budget check remains as a race-condition guard immediately before the Vercel release sequence.

V138 also adds an hourly retry controller. It compares the live `edgeforce-ai.vercel.app` alias to the current `main` commit, suppresses duplicate retries while another production run is active, rechecks the team-wide Vercel budget, and dispatches the guarded production workflow only when capacity has recovered and production is still behind.

This keeps the canonical Vercel release path fail-closed while allowing Edgeforce development and Cloudflare validation to continue during a shared Hobby-plan deployment-cap event. It does not bypass Vercel limits and does not create a deployment while the budget is constrained.
