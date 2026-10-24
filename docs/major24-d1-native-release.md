# D1-native EdgeForce production deployment — Major Build 24

The existing `deploy-cloudflare.yml` still requires Postgres credentials and migrations. This additive, manually dispatched workflow provides a separate path to deploy the modern D1 dashboard/Worker without requiring Neon, changing existing auth secrets, or activating paid sportsbook collectors.

## Runbook

1. Merge fully verified main only; collect the 40-character SHA on main and verify both `Verify Edgeforce` and `Verify Edgeforce Cloudflare` succeeded for that **exact commit**.
2. Confirm Cloudflare API token is authorized to deploy the existing `edgeforce-ai` Worker and query the existing `edgeforce-intelligence` D1 database.
3. Use GitHub Actions → `Deploy EdgeForce D1-Native Dashboard` → Run workflow on **main**, supply `expected_main_sha`, and explicitly acknowledge the no-paid-odds restriction.
4. The workflow requires disabled D1 odds archive writes, disabled ATLAS scheduled execution, and disabled demo fallback. It builds and verifies the Cloudflare artifact, performs an existing D1 schema read, verifies main has not moved, and deploys with existing production secrets unchanged.
5. Postdeployment it confirms `/api/health` and the owner-only `/api/operations/remote-dashboard` returns 401 without a token. Test authorized dashboard separately with the existing stable `CRON_SECRET` via your own secured client; never paste secrets into PRs or chat.
6. The dashboard is at `https://edgeforce-ai.tmbstartkleen.workers.dev/operations/dashboard` after a verified release. The deploy is NOT an approval to ingest bets, spend odds credits, or enable source registry writes.

## Preconditions and limitations

The D1 schema must include `intelligence_sources`, `specialist_tasks`, and `sports_market_snapshots`. The October 24 database inspection found these tables present but empty for sports odds and tasks. This workflow does not register licensed providers, populate sports odds, refresh sportsbook prices, authenticate provider ownership, calibrate independent models, or create positive-EV betting signals. It is only the production release route. The old Postgres-dependent services may still depend on their existing database; this route does not perform a broad backend migration. If any post-deploy check fails, inspect the prior deployment and use existing rollback controls.
