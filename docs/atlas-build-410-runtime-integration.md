# Build 410 — Trusted runtime integration gate

Status: **NOT CERTIFIED / execution disabled**.

## Verified now
- Scheduled task metadata and research instructions are stored in the private ATLAS Durable Object.
- The task coordinator, fenced lease, and Director adapter are implemented and tested as private modules.
- Founder-authenticated enqueue, inspect, cancel and interrupted recovery are available.
- The public and Durable Object HTTP execution routes reject dispatch.
- Tests and hosted-preview checks are **not** evidence of actual live Director dispatch.

## Architectural blocker
The current `executeTrustedScheduledResearch` method accepts a JavaScript `forward` callback and `clock` callback. These are process-local functions and cannot simply be sent as JSON through a Durable Object stub's HTTP `fetch` interface. Importing the executor into the Durable Object does not create a trusted invoker. Neither a user-supplied `ownerAuthorized` flag nor an HTTP body can substitute for authentication. The Director gateway currently uses `forward(request)` and persists the resulting mission separately.

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
