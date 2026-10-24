# D1-native EdgeForce production deployment — Major Build 24

The existing `deploy-cloudflare.yml` still requires Postgres credentials and migrations. This additive, manually dispatched workflow provides a separate path to deploy the modern D1 dashboard/Worker without requiring Neon, changing existing auth secrets, or activating paid sportsbook collectors.

## Runbook

1. Merge fully verified main only; collect the 40-character SHA on main and verify both `Verify Edgeforce` and `Verify Edgeforce Cloudflare` succeeded for that **exact commit**.
2. Confirm `CLOUDFLARE_API_TOKEN` can deploy the existing `edgeforce-ai` Worker. Separately, `CLOUDFLARE_D1_API_TOKEN` must have D1 Edit access to the production account and existing `edgeforce-intelligence` database (schema reads and the additive prediction-watch migration). D1 steps use only the D1 token; an absent token fails closed without falling back to the Worker token.
3. Use GitHub Actions → `Deploy EdgeForce D1-Native Dashboard` → Run workflow on **main**, supply `expected_main_sha`, and explicitly acknowledge the no-paid-odds restriction.
4. The workflow requires disabled D1 odds archive writes, disabled ATLAS scheduled execution, and disabled demo fallback. It builds and verifies the Cloudflare artifact, performs an existing D1 schema read, verifies main has not moved, and deploys with existing production secrets unchanged.
5. Postdeployment it confirms `/api/health` and the owner-only `/api/operations/remote-dashboard` returns 401 without a token. Test authorized dashboard separately with the existing stable `CRON_SECRET` via your own secured client; never paste secrets into PRs or chat.
6. The dashboard is at `https://edgeforce-ai.tmbstartkleen.workers.dev/operations/dashboard` after a verified release. The deploy is NOT an approval to ingest bets, spend odds credits, or enable source registry writes.

## Preconditions and limitations

The D1 schema must include `intelligence_sources`, `specialist_tasks`, and `sports_market_snapshots`. The October 24 database inspection found these tables present but empty for sports odds and tasks. This workflow does not register licensed providers, populate sports odds, refresh sportsbook prices, authenticate provider ownership, calibrate independent models, or create positive-EV betting signals. It is only the production release route. The old Postgres-dependent services may still depend on their existing database; this route does not perform a broad backend migration. If any post-deploy check fails, inspect the prior deployment and use existing rollback controls.

## Retry after the October 24 manual run #2 failure

Run [40116619401](https://github.com/tmbstartkleen-svg/Edgeforce-AI/actions/runs/40116619401) on `80e42add6b6e5fa06b3bc3ece5601321228bc5a1` passed lint, typecheck, preflight, compatibility, build and generated-config validation. It exited at the first remote D1 schema read, before migrations or deployment. The original command redirected stdout to an unarchived temporary file, so the saved log contains no underlying Wrangler error; do not attribute this failure to the lint or Node deprecation warnings. The workflow incorrectly inherited the Worker token for D1 instead of using the existing dedicated D1 secret. The repair scopes that secret to all three remote D1 steps and uses `tee` with `pipefail` to retain diagnostics while preserving failure status. A separate read-only Cloudflare connection confirmed all three baseline tables exist; that does not certify the GitHub Actions token.

After merging the repair, retrieve the **new main commit**, not this old SHA, the PR branch SHA, or GitHub's temporary PR merge SHA:

```bash
gh api repos/tmbstartkleen-svg/Edgeforce-AI/commits/main --jq .sha
```

Wait for both certification workflows to succeed on that exact new SHA. If main moves, obtain and certify its new SHA again. Start a **new manual run** on main with `expected_main_sha` set to that complete 40-character value and `acknowledge_no_paid_odds=true`. Re-running the old failed job uses the old workflow and will not pick up the fix. The post-merge SHA cannot be known before the merge exists.

Keep `D1_SPORTS_MARKET_ARCHIVE_ENABLED=false` and `ATLAS_SCHEDULE_EXECUTION_ENABLED=false`; do not dispatch collector workflows or change provider flags/secrets. This retry may apply the existing additive prediction-watch schema migration, but does not authorize odds collection or sports archive writes. If D1 authentication still fails, use the now-visible Cloudflare error to correct the dedicated token's account/resource permissions before another attempt; never bypass the schema gate.
