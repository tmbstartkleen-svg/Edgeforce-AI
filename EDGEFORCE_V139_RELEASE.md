# Edgeforce V139 — Team Vercel Deployment Governor

V139 replaces independent deployment retries with a shared release governor for the Vercel Hobby-plan team.

The latest 100 team deployments were dominated by Safeguard (57), TravAI (33), and Edgeforce (10). V139 therefore treats the deployment allowance as a shared resource instead of letting each project consume it independently.

The governor runs hourly and reserves six slots for emergency/manual recovery. Normal automated releases stop at 84 deployments in the trailing 24-hour window, below the 90-slot hard safety threshold used by the individual Edgeforce production workflow. Each governed project has a 55-minute cooldown, and at most three project actions can be approved in one governor run. Pending projects are ordered by oldest last deployment so a high-churn project cannot starve the others.

Edgeforce keeps its strict production workflow and is released by workflow dispatch only. Safeguard and TravAI use Vercel's linked Git source so the governor can deploy their latest main branches without copying credentials or source into Edgeforce. Their Git auto-deploy configuration is disabled separately so rapid commit streams are coalesced into governed hourly releases.

This design does not bypass Vercel limits. It reduces deployment amplification, preserves emergency capacity, and centralizes release pressure across the three active projects.
