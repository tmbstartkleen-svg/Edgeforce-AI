# Edgeforce V107 — Production Transport Repair

V107 fixes the first real post-credential production execution defects exposed after V106 credential recovery.

## Verified V106 production findings

- Vercel team authorization now succeeds.
- Dynamic Vercel project mapping now succeeds.
- Production project settings pull now succeeds.
- Cloudflare API token, account ID, database URL, and odds API key are now present.
- Vercel production stopped at protected-request transport because the CLI received global auth flags in a form that system curl interpreted as curl options.
- Cloudflare production stopped at migrations because the workflow validated EDGEFORCE_DATABASE_URL but passed only the repository-specific EDGEFORCE_DATABASE_URL secret instead of the supported fallback value.

## V107 repair contract

### Vercel
- use documented `vercel curl <path> --deployment <url>` form
- attach `--token` and `--scope` to the curl subcommand invocation
- apply the same protected-request form across SLO, baseline, health, launch, certification, convergence, and rollback calls
- update protected remote smoke syntax
- reject regression to the broken pre-subcommand auth ordering in release audit

### Cloudflare
- pass `secrets.EDGEFORCE_DATABASE_URL || secrets.DATABASE_URL` into migrations
- pass the same fallback database value into the Worker deployment action
- audit the database handoff contract

## Identity

- build: V107
- app: 107.0.0
- package: 0.107.0
- model: edgeforce-v107
- migration: v114 (unchanged)
