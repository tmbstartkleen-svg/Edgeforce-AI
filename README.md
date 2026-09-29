# Edgeforce AI

EV-first sports probability intelligence platform.

## Current build — V17 Release Candidate

V17 completes the planned production-readiness sequence.

### Release pipeline
- environment validation
- database migration validation
- optimized Next.js production build
- production-server smoke tests
- concurrency checks
- Vercel preview build from a prebuilt artifact
- hosted preview smoke test
- promotion of the exact tested preview
- explicit rollback workflow
- release-readiness API

### New V17 commands
```bash
npm run validate-env
npm run check-migrations
npm run remote-smoke
```

### New V17 endpoint
- `GET /api/release/readiness`

### Side-screen / hosted preview behavior
Once the GitHub repository is imported into Vercel, the generated preview URL can be opened as the live test view while the release workflow validates the same hosted build. No separate Edgeforce build is needed for the preview surface.

### Release Candidate workflow
The manual `Edgeforce Release Candidate` GitHub workflow:
1. builds Edgeforce
2. validates migration coverage through V17
3. verifies Vercel credentials
4. pulls preview environment
5. validates required environment configuration
6. creates a prebuilt Vercel artifact
7. deploys it as a preview
8. smoke-tests the hosted preview
9. optionally promotes the exact tested deployment

### Rollback
The manual `Edgeforce Rollback` workflow can roll back to the prior production deployment or to a supplied deployment URL/ID.

### Required Vercel setup
The repository must be imported as a Vercel project and these GitHub Actions secrets must be configured:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Runtime/provider/database secrets belong in Vercel environment settings, not source control.

### Current hosted status
The source repository is release-ready, but no Edgeforce Vercel project is currently present in the connected team. The release workflow becomes executable after that one-time import/link.

## Guardrails
- Hosted promotion only occurs after the preview smoke test passes.
- Rollback is a separate explicit action.
- Production test endpoints remain disabled by default.
- No provider or database credentials are committed.
- Data-quality and portfolio-risk gates remain active.
- Positive EV does not guarantee profit.
- The 30% daily gain display remains a target, not a promise.
- Edgeforce may recommend **NO BET**.
