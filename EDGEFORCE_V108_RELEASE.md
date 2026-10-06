# Edgeforce V108 — Production Bootstrap Repair

V108 fixes the two production defects exposed after V107 reached authenticated execution.

## Verified V107 production findings

- Vercel credentials, team authorization, dynamic project mapping, and project settings pull all succeed.
- Cloudflare credentials, account resolution, build, and generated Worker validation all succeed.
- Cloudflare migration reaches Neon but fails on v6 because the base schema was never applied to a fresh database.
- Vercel protected requests still fail because auth/scope flags placed after `vercel curl` are passed through to native curl.

## V108 repair contract

### Database bootstrap
- apply `db/schema.sql` before versioned migrations
- keep the base schema idempotent through existing `CREATE ... IF NOT EXISTS` statements
- then apply `v6.sql` through `v114.sql` using the durable `schema_migrations` ledger

### Vercel protected requests
- keep explicit token/scope auth for project inspection, link, pull, build, and deploy commands
- use native `vercel curl` syntax for protected runtime requests without passthrough CLI flags
- rely on the linked project and authenticated Vercel CLI environment
- apply the same behavior to remote smoke

### Regression coverage
- release audit verifies base-schema bootstrap
- release audit forbids passthrough token flags on protected `vercel curl` requests
- smoke verifies the V108 production bootstrap repair capability

## Identity

- build: V108
- app: 108.0.0
- package: 0.108.0
- model: edgeforce-v108
- migration: v114 (unchanged)
