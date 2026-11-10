# EdgeForce Build 410 — Founder-approved autonomous source audits

## What was implemented

Build 410 adds Cloudflare Durable Object alarm scheduling for a **read-only D1 source health audit** to the existing private `AtlasMissionRoom`. The new Founder-only command surface under `/network` provides a scheduling interval, explicit Enable/Disable buttons, manual one-shot audits, job status and internal alerts.

### Controls
- Default **disabled**. No schedule exists until the Founder explicitly opts in with the private token.
- Available intervals: hourly, every three hours, every six hours.
- Only D1 `intelligence_observations` metadata is queried: source ID, latest observation timestamp and count per source; no raw payload, sportsbook scraping or paid-provider/API traffic.
- Cloudflare Durable Object `alarm()` triggers audits. One-off audits can be enqueued manually.
- Audit jobs are bounded to 60 historical entries, three attempts, retries at 1 and 5 minutes. Stale RUNNING jobs can be retried after an interruption.
- Duplicate in-flight audits are rejected, and manual one-shot audit submissions are limited to six per hour. Failed/empty/stale source conditions become private alerts, capped at 35 records, with one-hour deduplication by alert type.
- `GET/POST /api/network/audit` routes through the Worker gateway. The same Founder authorization gate protects status and state-changing operations.
- Neither AI models nor external notifications are invoked from the alarm handler. No betting, financial transactions, purchases, or deployments are permitted.

### What this is not
The scheduler checks the **existing** D1 observations. It does **not** discover all DraftKings leagues, ingest new odds, perform automated independent sports predictions, or prove that licensed data coverage is complete. These require later builds, provider access, and separate owner approval.

### Activation
The preview is code/build testable without credentials, but live writes and scheduled execution require deploying the registered Durable Object binding to a configured Cloudflare environment. Set `EDGEFORCE_NETWORK_OWNER_TOKEN` as a private Worker secret. Do not share tokens in chat.

#The current-main Cloudflare configuration retains `ATLAS_SCHEDULE_EXECUTION_ENABLED=false` as a global kill switch. Founder authentication **and** an explicitly approved environment change to `true` are required before enabling recurrence or queuing a manual audit. The status screen identifies this gate. This build does not flip that flag on behalf of the Founder.

## Verification
- `npm run test:network-autonomous-audit`
- `npm run test:network-director-tasks`
- `npm run lint`
- `npm run typecheck`
- Cloudflare Worker build and preview smoke tests.

No production deployment is implied by a successful preview.

## Remaining launch roadmap
After Build 410: **five** planned builds (411–415): licensed all-league coverage, player intelligence, live markets, independently validated quantitative predictions, and production launch certification.
