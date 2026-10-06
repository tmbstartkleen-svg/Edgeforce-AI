# Edgeforce V106 — Production Credential Recovery

V106 hardens the automated production fan-out after V105 proved both deployment workflows trigger from the same verified main commit.

## Verified V105 production blockers

- Vercel token exists, but is not authorized for the configured team scope.
- The previous committed Vercel project ID no longer resolves.
- Cloudflare GitHub Actions production secrets are incomplete.
- The Cloudflare account ID is already public configuration in `wrangler.jsonc` and does not need to be secret.

## V106 recovery contract

### Vercel
- stop trusting a committed project ID
- verify team/project authorization before deployment
- dynamically link `edgeforce-ai`
- read the live `.vercel/project.json` mapping
- export resolved org/project IDs for deployment and rollback
- fail closed with an actionable message when the token is not team-authorized

### Cloudflare
- use the repository account ID as a safe fallback
- accept either `EDGEFORCE_DATABASE_URL` or `DATABASE_URL`
- retain `CLOUDFLARE_API_TOKEN` as a required deployment credential
- report the exact missing prerequisite names before exiting

## Identity

- build: V106
- app: 106.0.0
- package: 0.106.0
- model: edgeforce-v106
- migration: v114 (unchanged)
