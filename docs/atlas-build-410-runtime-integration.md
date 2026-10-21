# Build 410 — Trusted runtime integration gate

Status: **NOT CERTIFIED / execution disabled**.

## Verified now
- Scheduled task metadata and research instructions are stored in the private ATLAS Durable Object.
- The task coordinator, fenced lease, and Director adapter are implemented and tested as private modules.
- Founder-authenticated enqueue, inspect, cancel and interrupted recovery are available.
- The public and Durable Object HTTP execution routes reject dispatch.
- Tests and hosted-preview checks are **not** evidence of actual live Director dispatch.

## Runtime integration status and staging blocker
A private Durable Object RPC method, `executeTrustedScheduledResearch`, now exists and constructs its own Director service forwarder and clock server-side. The original callback-serialization blocker described in earlier revisions is **resolved in code**, not yet live-certified. `dispatchAtlasScheduledRpc` is a trusted Worker entry point, but is **not attached to a public route, cron, or alarm**. The configured `ATLAS_SCHEDULE_EXECUTION_ENABLED` flag remains `false`.

The `ATLAS_DIRECTOR_SERVICE` binding points at `edgeforce-ai` itself. The bound request reaches `worker/index.ts`, which sends POST `/api/network/director` through `atlasGateway` and then the existing handler. The gateway also uses `ATLAS_MISSION_ROOM` to persist the Director report. Thus a Durable Object RPC invocation can await a Worker request that re-enters the same Durable Object for journaling. **Do not assume this is deadlock-free or that report persistence succeeds** without a controlled Cloudflare staging execution. No production activation or autonomous dispatch is authorized.

Evidence still required: run a Founder-authorized task in an isolated staging environment, confirm the Director returned matching `ok:true`, `durable:true`, `persisted:true`, read back the durable mission and scheduled task, and record their IDs with a timestamp and deployment version. Failure, timeout, duplicate execution, or missing readback must block certification. Do not put secrets or bearer tokens in logs or certification documents.

## Required implementation for certification
1. Choose a supported Cloudflare execution boundary: an authenticated Worker orchestration route using **internal claim/finish messages** to the Durable Object, or a Durable Object RPC method that constructs the Director service binding and its credentials server-side. Do not serialize function callbacks.
2. Authenticate the Founder **before** any claim, derive authorization from the actual Worker secret, and use a server-controlled execution-enable flag defaulting to disabled.
3. Atomically claim a queued task using its expected state/attempt count and a fenced lease; persist the lease before contacting the provider.
4. Dispatch only the stored, validated research instruction to the existing quota-controlled Director gateway/provider. Require a journaled matching report (`ok:true`, `durable:true`, `persisted:true`) before completing the scheduled task.
5. Finish the task only under the matching unexpired fencing epoch. On ambiguous provider failures or expired leases, fail closed and require explicit owner recovery; never automatically repeat a possibly successful side effect.
6. Add Worker + Durable Object integration tests for unauthorized, disabled, duplicate, provider failure, response mismatch, and expired-lease cases.
7. Execute a real Founder-authorized Cloudflare staging smoke test; record task ID, durable mission ID, results, and verification link without exposing credentials. Only then consider activation or promotion.

## Non-goals
No public claim/complete endpoints, no automatic cron/alarm execution, no unverified odds/scores counted as sportsbook quotes, and no claim that Build 410 is finished before runtime certification.

## Staging certification evidence checklist
A passing CI build or preview bundle alone is not evidence of successful ATLAS research execution. Before marking Build 410 complete, attach a staging-only report recording: (1) deployment name/version and isolation from production; (2) the authorized test invocation time and scheduled task ID; (3) a successful Director response with matching question and durable mission ID; (4) an authenticated readback of that exact mission record; (5) an authenticated readback of the scheduled task showing completed state and matching lease attempt; (6) screenshots or sanitized logs for the test, with all tokens removed; and (7) confirmation that production `ATLAS_SCHEDULE_EXECUTION_ENABLED` remains `false`. Any timeout, missing record, duplicate mission, or inconsistent state is a failed certification, not a soft pass.

Do not enable a staging execution path that binds back to a live production Director without separately confirming data isolation and authorization. No automatic cron, alarms, public dispatch routes, or owner-token logging.
