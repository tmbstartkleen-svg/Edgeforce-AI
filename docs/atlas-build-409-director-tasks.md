# Build 409: Director Task Collaboration Board

## Scope
ATLAS's existing real bounded AI request coordinator now writes a **durable director task record** for each Founder-directed mission, followed by the model-generated division reports. Owner-authenticated users can view the task board, filter by division director, and inspect preserved evidence and limitations.

- Founder owns policy and approvals. ATLAS is the unique director. MERCURY, VECTOR, PULSE, FLASH, SENTINEL and FORGE are division directors.
- The original mission journal from Build 408 remains intact.
- New private Durable Object endpoints: GET /tasks, POST /tasks/start, POST /tasks/finish.
- New public, Founder-authenticated gateway endpoint: GET /api/network/tasks (read-only).
- Each mission creates an ATLAS RUNNING task after admission reservation and before invoking external research.
- The final research report is stored, then director task records are finalized with statuses, evidence and limitations. Failed missions are marked FAILED whenever possible; interrupted RUNNING tasks older than five minutes are displayed as INTERRUPTED.
- Duplicate IDs and finalization of already-finished tasks are rejected.
- At most 120 task records are retained in the private room, with 60 requested through the gateway and the UI filtering by director.
- UI has a Director Task Board navigation item, Refresh Activity button, director filter, and report cards. Viewing requires the same private Founder token.

## Engineering honesty
This is an **authenticated task record and agent collaboration log**, not yet an autonomous, independent always-running workforce or a live WebSocket team chat. Models still receive a common snapshot and coordinate within a single request. Build 410 will focus on durable scheduling, retries, and bounded operations without hiding source limitations.

## Deployment
Requires approved production secret EDGEFORCE_NETWORK_OWNER_TOKEN and a live model API secret plus correctly deployed AtlasMissionRoom Durable Object binding. CI preview without keys cannot validate actual paid AI research or provider entitlements. No automatic wagering or vendor spending.

## Verification
npm run test:network-director-tasks
npm run test:network-persistence
npm run test:network
npm run lint
npm run typecheck
npm run build
Cloudflare build and hosted-preview checks

## Fixed project scope (seven builds total after 408)
- 409 Director Task Collaboration (this increment)
- 410 Autonomous Scheduling, Bounded Retries and Alerts
- 411 Licensed Sports/League Coverage and Discovery
- 412 Player Props, Injuries and Lineup Intelligence
- 413 Live Lines, Arbitrage and Market Movements
- 414 Model Calibration, EV Verification, CLV and Results
- 415 Release Security, UI QA and Production Certification

Do not call 415 complete unless all acceptance gates and sources are operational. Additional repairs within a numbered increment are not counted as finished launches.
