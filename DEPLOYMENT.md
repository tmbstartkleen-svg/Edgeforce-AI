# Edgeforce AI V17 deployment

## Release strategy
verify -> migration check -> preview build -> hosted smoke test -> promote exact artifact -> observe -> rollback if needed

## One-time Vercel setup
1. Import `tmbstartkleen-svg/Edgeforce-AI` into the connected Vercel team.
2. Use the repository root as the project root.
3. Framework: Next.js.
4. Add runtime environment variables from `.env.example`.
5. Add GitHub Actions secrets:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`
6. Apply database migrations through V17.

## Side-screen testing
After the Vercel project exists, use the preview deployment URL as the live Edgeforce testing surface. The same preview URL is what the release workflow smoke-tests before promotion.

## Pre-release gates
- `npm run build`
- `npm run check-migrations`
- V16 production-server smoke suite
- V16 concurrency check
- Vercel preview deploy
- hosted `/api/health`
- hosted `/api/deployment/smoke`
- hosted `/api/diagnostics`
- hosted dashboard request

## Promotion
Use the manual **Edgeforce Release Candidate** workflow with `promote=true`.

## Rollback
Use the manual **Edgeforce Rollback** workflow.

## Release readiness endpoint
`GET /api/release/readiness`

This reports configured secret presence, provider counts, database health, Vercel environment, deployment URL, and commit metadata without exposing secret values.
