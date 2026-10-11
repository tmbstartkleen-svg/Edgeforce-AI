# V119 Intelligence Core — controlled activation runbook

The Intelligence Core is not a standalone authoritative source of sports results or sportsbook quotes. Data source identity, license, freshness and observation provenance are mandatory.

## Release sequence
1. Require exact-main GitHub verification and successful Cloudflare production release.
2. Verify the database migration registry includes `v119` and that all intelligence_* tables exist.
3. Call authenticated `GET /api/operations/intelligence-core/readiness` using the production CRON_SECRET; never expose it to the browser or log it.
4. Register real upstream providers through reviewed administrative SQL only after verifying endpoint terms and vendor identity; do not seed fictional providers.
5. Enable `INTELLIGENCE_WAREHOUSE_MIRROR_ENABLED=true` first, with `INTELLIGENCE_CORE_ENABLED` still off. Confirm real odds observations with source timestamps, event IDs and a distinct upstream, and confirm no production CPU regression.
6. If source-dated injury data exists, optionally enable `INTELLIGENCE_WAREHOUSE_INJURY_MIRROR=true`. A provider payload lacking source timestamps must not be forcibly mirrored.
7. Existing Worker crons already execute scans and injury refreshes. **Do not enable a second Intelligence Core scheduler while those are active.** Choose a single execution owner before setting `INTELLIGENCE_CORE_ENABLED=true`.
8. After a dedicated scheduler rollout, prove bounded jobs, settled leases, successful runs and fresh observations. Only then evaluate expanding score/stat/prediction collectors.
9. Keep `ALLOW_DEMO_DATA=false` in production and never treat absence of independent odds sources as verified redundancy.

## Rollback
Set Intelligence Core flags to false through the existing secure deployment configuration; keep the warehouse tables intact for auditing. If Cloudflare exceeds CPU or subrequest limits, stop the new jobs before modifying existing production pipeline. No new cron triggers are introduced in this release.

## Interpretation
`activationAllowed` is an evidence gate for provider registration, schema, stored recent observations and run health. `runtimeHealthy` additionally requires enabled execution and recently completed work. Neither asserts predictive accuracy, all-sport availability or two independent live bookmakers.

## Testing
`node --test tests/intelligence-core-readiness-evaluator.test.mjs`
`npm run typecheck`
`npm run check-migrations`
