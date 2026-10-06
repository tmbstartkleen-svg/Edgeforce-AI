# V119 production-target fidelity repair

## Scope

Keep V119 / 119.0.0 / edgeforce-v119 / migration v114. This repair changes deployment targeting and evidence, not the sportsbook models, provider limits, settlement outcomes, or operational gate policy.

The previous deployment workflow pulled production settings but built and deployed a preview artifact. The candidate now uses `vercel build --prod` and `vercel deploy --prebuilt --prod --skip-domain`. The production alias must remain on its prior deployment until the existing certification, SLO, canary and V1 gates pass and the explicit promote step runs.

## Actual production identity

A READY production-target deployment is not necessarily serving the production domain. Capture the rollback target through the project-scoped `/v4/aliases/{alias}` response, not the newest READY deployment listing. Validate the deployment project, target, ready state and URL. Validate the staged candidate's exact source commit metadata.

Check the alias again after staging, before promotion and after promotion. Post-promotion evidence must also fetch health through the actual production alias and match the exact release and source commit. A changed or malformed alias response blocks progress.

## Configuration diagnostics

The workflow prints only allowlisted provider-variable presence in production and preview. Raw API environment values, encrypted values, custom keys, provider URLs and credentials are never printed by this diagnostic. The temporary metadata response file is removed when the diagnostic step exits.

Presence does not prove a valid credential, available quota, provider compatibility, usable fresh odds or correct market-selection result mapping. Do not replace a result provider with a raw scoreboard.

## Verification

The new dependency-free production-target test suite covers alias/project/commit mismatches, premature production traffic assignment, invalid URLs, environment metadata redaction, CLI error redaction, mandatory staging flags and gate ordering. It runs after every typecheck alongside the existing runtime-repair and smoke-transport tests.

Local verification passed 15 tests and syntax checks for the workflow shell blocks. Branch preparation workflow 37483344974 passed the 15 tests and release audit, and compared the critical existing release steps byte-for-byte to d246f439c6f90a5ca4f3350aa20544fbd2811a22. Its one-time branch-only preparation workflow was removed before normal PR verification.

Full pull-request verification and production workflow results remain separate evidence. Passing local fixtures or a release audit does not certify the live application.

## Unresolved release checkpoint

Issue #151 remains open. At the last verified d246f439 production run, Cloudflare deployment passed, while Vercel remained blocked at its candidate SLO gate. The available evidence showed an exhausted full-odds quota, no acceptable complete persisted slate, missing selection-level RESULTS configuration, failed settle/decision automation, three ACTION incidents and a protective automation circuit. A fresh FanDuel pulse supplied limited price continuity only.

This repair does not clear those conditions. Verify production configuration and actual provider responses, repair affected dependencies, rerun failed jobs and require real recovery before resolving incidents or promoting. Do not reset SLO history or waive current critical health to obtain a green deployment.
