# Edgeforce V145 — Primary / Standby Production Closure

V145 updates Edgeforce release closure to match the production architecture introduced in V144.

Cloudflare Workers is the automatic production primary. Vercel remains a manual disaster-recovery standby. The two platforms are no longer required to run the same commit during ordinary operation.

A production release closes when:
- the exact main SHA passed both required GitHub verification workflows,
- the Cloudflare Worker reports the exact release/model/migration/commit identity,
- the Cloudflare platform launch doctor passes,
- the hosted Cloudflare smoke suite passes,
- the Vercel production alias still resolves to a READY deployment,
- the Vercel standby health endpoint responds successfully,
- Vercel remains configured as manual-only disaster recovery,
- and there is no confirmed rollback invalidating the Cloudflare primary commit.

Vercel standby commit drift is recorded as evidence and is expected. It becomes relevant only when a failover or standby refresh is actually initiated.

The existing release_platform_convergence and release_final_closures tables are retained for compatibility. Their legacy convergence fields now represent production topology readiness when the evidence topology is cloudflare-primary-vercel-standby. No database migration is required; migration identity remains v118.

The Cloudflare production workflow verifies the Vercel standby by reading the existing alias and deployment and checking /api/health. It does not create a Vercel deployment, consume a Vercel deployment slot, or promote the standby.

Operator panels now display Cloudflare primary readiness, Vercel standby readiness, standby commit drift, and the primary/standby closure certificate instead of claiming same-commit dual-platform convergence.
