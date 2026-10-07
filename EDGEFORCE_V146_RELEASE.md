# Edgeforce V146 — Production Topology Watchdog and Failover Readiness

V146 turns the Cloudflare-primary / Vercel-standby architecture into a continuously verified operating state.

## Hourly topology watchdog

The existing Cloudflare hourly cron now runs `/api/cron/topology-watchdog`. The watchdog verifies that:

- the active Cloudflare deployment commit matches the latest certified topology evidence,
- the active Cloudflare commit matches the latest closed production certificate,
- the Cloudflare primary passed exact-main certification, hosted smoke, and platform readiness,
- the Vercel standby remains recorded as READY and manual-only,
- the canonical Vercel standby alias responds successfully,
- the standby reports the expected release version and migration version,
- and the manual disaster-recovery target still has a concrete deployment ID.

The watchdog records into the existing `automation_runs` table. No new database migration is required.

## Bounded standby probing

The public standby health probe retries a maximum of three times for transport failures or HTTP 5xx responses. Each attempt has an eight-second timeout. This prevents one transient edge failure from immediately declaring the standby unavailable while still failing closed when the standby remains unhealthy.

## Manual failover packet

The watchdog produces a failover-readiness packet containing:

- current Cloudflare primary commit,
- Vercel standby deployment ID,
- Vercel standby URL and commit,
- standby health state,
- and the explicit policy that any promotion requires human approval.

Automatic standby promotion remains disabled. V146 does not deploy or promote Vercel.

## Operator surface

A new dashboard panel shows:

- PRIMARY current state,
- STANDBY live health,
- FAILOVER readiness,
- AUTO FAILOVER = OFF,
- topology blockers and warnings,
- and expected standby commit drift.

The read-only `/api/operations/production-topology` endpoint exposes the same report.

## Cloudflare secret handoff hardening

Production runtime secrets are generated before the Worker build so vinext build-time environment access and Cloudflare runtime bindings resolve to the same INGEST_SECRET and CRON_SECRET values. Provider certification tolerates only a bounded post-deploy HTTP 401 propagation window: up to ten attempts, two seconds apart. Persistent authentication mismatch still blocks the release.

## Certification

V146 adds deterministic test fixtures for healthy topology, unhealthy standby, stale production closure, commit-drift allowance, and automatic-promotion prohibition. Health, smoke, release audit, and the mandatory post-typecheck suite all cover the new contract.

Migration identity remains v118.
