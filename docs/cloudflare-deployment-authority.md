# EdgeForce Cloudflare deployment authority and duplicate-build recovery

## Canonical production deployment

The **canonical Cloudflare production deployment authority** is the GitHub Actions workflow **Deploy Edgeforce to Cloudflare** (`.github/workflows/deploy-cloudflare.yml`) on `main`. A successful **Verify Edgeforce** run on `main` starts it automatically; manual dispatch on `main` remains available for recovery. It waits for successful exact-SHA runs of both **Verify Edgeforce** and **Verify Edgeforce Cloudflare**, validates the Vinext artifact, checks production prerequisites and migrations, and rejects a commit if `main` has advanced before deployment. Production deployments are serialized with cancellation disabled. This workflow deploys with managed runtime secrets using `dist/server/wrangler.json` and performs hosted identity/health checks at the production Worker, `https://edgeforce-ai.tmbstartkleen.workers.dev`.

Do not replace this path with a direct Mac `wrangler deploy` or a separate Cloudflare Git build: that bypasses the repository's production release controls.

## Why Cloudflare's automatic Git Builds check is failing

The Cloudflare dashboard for `edgeforce-ai` has shown automatic Git Builds settings of `npm run build` followed by either `npx wrangler deploy` (main) or `npx wrangler preview` (pull requests), with root `/`.

- `npm run build` invokes Next.js and **does not generate** the deployable Vinext configuration.
- The canonical Worker build is `npm run build:vinext`, producing `dist/server/wrangler.json`, a Worker entry point, and client assets.
- A bare `npx wrangler deploy` uses root `wrangler.jsonc`, whose `assets` lacks the `directory` expected for that deployment mode. Observed error: `The assets property in your configuration is missing the required directory property`.
- `npx wrangler preview` is **not** the project's supported isolated preview deploy command.

**Preferred operator action:** In Cloudflare → Workers & Pages → `edgeforce-ai` → Settings → Build, disable the redundant *automatic Git Builds integration* for this Worker while **preserving the Worker, its D1 binding/database, production route, environment variables, secrets and GitHub Actions credentials**. Do not delete the Worker. Do not turn off the independent GitHub-hosted preview workflow. A setting change may require reviewing branch protection / required checks so an orphaned Cloudflare build status is not treated as certification or used to block unrelated merges forever. Required-check changes must be reviewed by a repository administrator; do **not** force-merge a failed check.

If Cloudflare Git Builds must be retained, configure a **non-production** preview-only path using a separate preview Worker name, no production cron triggers, the Vinext artifact, and an audited secrets/binding policy. Do not set a second production deploy authority merely to get a green check.

## Local verification (no production deployment)

```bash
cd ~/Edgeforce-AI
npm ci
npm run build:vinext
npm run validate:cloudflare-build
npm run typecheck
```

Check `dist/server/wrangler.json` exists after the build. `npm run typecheck` includes post-typecheck regression tests. If testing the certification Bash step on a pre-PR-346 checkout, GitHub's `GITHUB_ENV` is not supplied by macOS shells; PR #346 makes that test self-contained.

## Promotion checklist

1. Ensure the canonical build and smoke checks are green for the exact target commit.
2. Resolve the duplicate Cloudflare Git Builds integration and distinguish its check from **Verify Edgeforce Cloudflare**.
3. Review and merge PRs normally only after required checks and merge policies are satisfied.
4. Follow the automatically triggered `Deploy Edgeforce to Cloudflare` run for the certified **main** commit. If recovery requires manual dispatch, use this same workflow on `main` and retain both exact-SHA certification gates.
5. Verify runtime identity, health, data provenance, sportsbook freshness and rollback readiness. Successful compilation is not evidence that odds/provider coverage is live.

## Database caveat

The canonical production workflow still requires a Neon/PostgreSQL connection, checks it with a read-only preflight and applies PostgreSQL migrations. The production Worker also binds D1 databases and serves D1-backed operations routes, including the archived sportsbook evidence review. These routes and the separate D1 pilot do not establish a complete storage migration. The separately gated manual D1-native dashboard workflow is not a replacement for the canonical feature-release path above. Do not remove Neon configuration, migration steps or historical data until runtime cutover and data parity are verified.

For a bounded read-only post-release check, `/api/health` reports the deployment commit and tests the PostgreSQL connection, while `/api/operations/d1-pilot/health` performs only a D1 `SELECT 1`. Their success establishes runtime identity and database connectivity; capability flags in `/api/health` do not certify current quotes or model calibration. `/api/live-data/status` calls provider ingestion, and the full remote smoke script exercises provider-backed routes, so neither is a database-only diagnostic.
