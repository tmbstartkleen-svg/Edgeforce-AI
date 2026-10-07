# Edgeforce V137 — Team-wide Vercel Deployment Budget

V137 repairs the production preflight that protects the Vercel free daily deployment allowance.

The V126 guard queried deployments with the Edgeforce project ID, so it counted only `edgeforce-ai` usage. Vercel enforces the free daily deployment cap across the team/account, which allowed the guard to report 21 recent Edgeforce deployments while Vercel rejected the next upload because the team had already exceeded 100 deployments in the rolling 24-hour window.

V137 removes the project filter from the budget query and counts the team-wide deployment list. The existing safety threshold remains 90, so a release now fails before build/deploy upload when shared team usage is near the platform cap. Setting the threshold to 0 still disables this guard after an appropriate plan upgrade.

This change does not bypass Vercel limits or retry a rate-limited deployment. It prevents unnecessary uploads and preserves capacity for the canonical production release path.
