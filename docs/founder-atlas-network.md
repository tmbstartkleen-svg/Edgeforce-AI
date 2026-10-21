# EdgeForce AI — Founder Command Network

## Executive authority (Build 407)

Founder & Executive Chairman: the user. Sole ultimate decision maker.
ATLAS: Chief Director, accountable only to Founder.

Divisions:
- MERCURY — Sports Data Network, SCOUT and RELAY
- VECTOR — Quantitative Research, ODDS and MONTE
- PULSE — Player Intelligence, PROPS and MEDIC
- FLASH — Live Markets, ARB and RADAR
- SENTINEL — Independent Verification and Risk, AUDIT and LEDGER
- FORGE — Engineering and Operations, WATCHTOWER

Spending, data purchasing, deployments, public verified picks and wagering require explicit Founder approval. This release contains no automatic wagering integration.

## Current implementation

- Responsive /network command room, hierarchy, tasks and specialist reports.
- Bearer Founder authentication required for POST /api/network/director, with a hashed constant-time token comparison.
- Real bounded model calls: ATLAS plans a mission, delegates to 1–3 directors in parallel, SENTINEL independently challenges results, ATLAS synthesizes an executive report.
- Owner questions, evidence, failure disclosures and task logs appear in the interface.
- Agents use one common existing provider-ingestion snapshot. Missing evidence and missing sports are disclosed.
- There is no background autonomous execution, streaming or server-persisted multi-user chat yet.
- The browser holds the private Founder token in component memory, not persistent storage.

## Required Cloudflare Worker secrets

Use deployment-specific Wrangler configuration to set secrets without exposing values:
- EDGEFORCE_NETWORK_OWNER_TOKEN — long randomly generated value, minimum 24 chars
- EDGEFORCE_NETWORK_AI_API_KEY — valid, privately managed API account key

OPENAI_API_KEY is supported as a fallback where already provisioned. Optional variable EDGEFORCE_NETWORK_MODEL defaults to gpt-4.1-mini (subject to account availability).

Never publish these secrets in GitHub, chat, documentation, or browser source. The Founder enters the owner token privately when requesting research.

## Production acceptance

1. Verify lint, TypeScript, test:network, test:team, Cloudflare worker build and hosted preview.
2. Validate authorized provider entitlements and model account budget.
3. Confirm unauthorized requests fail before model and odds ingestion.
4. Validate source coverage, freshness and quality labeling.
5. Validate real hosted model research, task delegation, independent audit and cost accounting.
6. Configure Cloudflare request rate limits and service budgets.
7. Merge and deploy only via production release gates.

## Next stage: durable independent bot organization

Current collaboration is a bounded AI-assisted research request, NOT continuously autonomous bots. Next implement Cloudflare Agents SDK and Durable Objects / Workflows for:
- Persistent authenticated Founder and team chat and task history
- Individual agent task queues, fan-out/fan-in, retries and cancellations
- Authorized scheduled ingestion by sport, league and live-vs-pregame state
- Reproducible simulation, model evaluation and settlement feedback loops
- Model quality scoring and independently verified edge gating
- Alerts only after owner opt-in and verified inputs
- Measured league coverage relative to licensed source inventory

## Product mission

Build a measurable competitive advantage rather than claim superiority without evidence. Compare actual league/market coverage, provider freshness, in-play latency, prop completeness, Brier score and calibration, closing line value, settled ROI, risk, and false-positive arbitrage against competitors.

No outcome probabilities or ROI are guaranteed. Market-reference price comparisons must not be described as independent verified positive-EV opportunities.
