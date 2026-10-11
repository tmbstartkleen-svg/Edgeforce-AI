# EdgeForce V211 — First-party Multi-Agent Sports Network Infrastructure

## Architecture and honest source boundaries

EdgeForce is the **primary backend interface, durable storage, normalization, research archive and analytics coordination system**. The private network API serves authorized observations and model results. GPT-6/ChatGPT can act as an optional analyst of those records through a separately funded model API, but this ChatGPT conversation is **not a server, hosted sports feed or unlimited API key**. Neither an LLM nor our database invents DraftKings, FanDuel, Kalshi, Polymarket, official play-by-play or player-injury facts.

V211 creates a real bot team with persistent responsibilities, no unbounded subrequests, source labels and recorded health.

| Specialist | Primary role | Upstream HTTP requests by default | Minimum cadence |
| --- | --- | --- | --- |
| Market Watch | Investigate source timestamps, odds recency and bookmaker coverage on stored tape | None | 60 min |
| Score Watch | Check saved source-declared finals and league coverage | None | 60 min |
| Injury Watch | Examine already-received injury snapshots, expiry and source freshness | None | 60 min |
| Player Research | Check retained player statistics, last import and league coverage | None | 90 min |
| Forecast Auditor | Monitor model-run evidence and note missing calibration | None | 90 min |
| Bookmaker Comparison | Compare recently stored book/provider labels, never certify independent upstreams automatically | None | 90 min |
| Score Scout | Fetch one explicitly approved ESPN scoreboard league and date, store a small source-identified summary | **One if enabled and authorized** | 120 min |

These roles are functional scheduled data tasks, not seven separately thinking GPT instances. Paid AI Analyst calls can later summarize the recorded evidence under a separate budget, but no paid LLM is invoked in V211. This is much safer on Cloudflare and is less expensive than trying to use a general model to crawl every sport on every page refresh.

## Database

`db/v211.sql` creates `edgeforce_network_agents_v211` (per-agent enabled flag, due time, lease token, lease expiration, retry status, failure count, counters) and `edgeforce_network_agent_observations_v211` (append-only source role, publisher IDs, timestamped normalized summary, result and run ID). Due agent claims use atomic `FOR UPDATE SKIP LOCKED` and a short lease; each dispatch does **at most two** agent jobs, with at most one bounded SQL read per agent and a small durable observation write. No enormous, cascading Worker cron loops.

## Private REST endpoints

- `GET /api/network/v1/agents` — source-attributed health, next due, latest evidence, last success/failure, runs and coverage.
- `POST /api/network/v1/agents/dispatch` — JSON `{ "maxJobs": 2 }` to run up to two due specialists. Requires the existing first-party SHA256-verified bearer token. Default HTTP return is **disabled** if `EDGEFORCE_AGENT_TEAM_ENABLED` isn't `true`.

Neither endpoint should be made public or accessible through client bundles without operator authorization. The Sports Network sidebar includes a private **Sports intelligence agents** console that lets the owner inspect health or manually run eligible work.

## Continuous scheduling (opt-in, with actual host requirements)

`.github/workflows/sports-network-agent-team.yml` defines a recurring GitHub Actions dispatcher at minute 7 and 37 every hour **only on the repository's default branch**, plus manual workflow dispatch. GitHub-hosted jobs can be delayed; they are not a real-time 24/7 push stream. Once merged, the workflow can operate repeatedly without leaving this chat open if all below settings are configured.

1. Apply all pending database migrations, including **V205–V211** in correct order, especially `db/v211.sql`, to the shared EdgeForce PostgreSQL DB. Do not apply fixtures or destructive resets to production.
2. Generate a private 64-digit token and hash it locally (the instructions in `EDGEFORCE_V205_SPORTS_NETWORK.md` explain how). Set the hash as GitHub Actions secret `EDGEFORCE_NETWORK_TOKEN_SHA256` so the Cloudflare deploy can verify incoming requests. Save the actual 64-digit token separately as GitHub Actions secret `EDGEFORCE_NETWORK_TOKEN_RAW` so the scheduled dispatcher can authenticate. **Never use the raw token as the hash; never publish either value.**
3. In GitHub Actions **Variables**, set `EDGEFORCE_AGENT_TEAM_ENABLED=true`. Merge/deploy the entire PR stack only after verification. That same variable is included in Cloudflare runtime secret delivery; it enables scheduled specialist jobs only when the Worker is running V211.
4. Check `GET /api/network/v1/agents` with the owner bearer token, and review real database timestamps after an Actions run. Only then call continuous scheduling live.

## Optional score source scout

By default Score Scout does nothing and cannot query ESPN. Enable `EDGEFORCE_AGENT_SCORE_SOURCE_ENABLED=true` and set `EDGEFORCE_AGENT_SCORE_FEEDS=nfl,nba,nhl` (choose only explicitly approved league IDs) **only after confirming legal source retention/reuse rights** and setting `EDGEFORCE_OUTCOME_ALLOWED_SOURCES=espn-scoreboard` under the V209 opt-in policy. Every scout run queries a single current-day scoreboard league, retains at most sixteen source-identified game summaries and does not claim publisher-native timestamps that the feed didn't expose. It never counts as an independent sportsbook odds provider.

Existing live score refresh and injury ingestion adapters remain independent. V211's Injury Watch examines existing persisted snapshots; it does not add another expensive injury cron. Existing SharpAPI and sportsbook quota controls remain intact.

## Release and cost guardrails

- Disabled-by-default, authenticated, Postgres lease + recovery, one score provider request per explicitly licensed scout run, no sportsbook odds scraping, and maximum two workers per scheduled dispatch.
- GH Actions schedule is every 30 minutes, but agents have per-specialist 60–120 minute cooldowns and may run less frequently during Github delays, failures or congestion. They do not represent per-second live streaming.
- External source licenses, Cloudflare subrequests, Postgres usage, storage, GH Actions limits and AI model costs still apply. The owned network can reuse its permitted stored data but cannot bypass these costs or supply missing official information.
- Before a production merge: verify TypeScript/ESLint, strict unit tests, isolated PostgreSQL claim test, Cloudflare Worker compatibility, hosted preview smoke and release checks. Vercel remains manual-only standby. No credentials, customer accounts or paid subscriptions are created by this PR.

## Next quality upgrade

Introduce separate provider-native score snapshots, injury update events, licensed player-stat ingest queues, and a **budgeted AI analyst** that consumes these outputs as evidence with citations to provider ID, observed time and license metadata. Add calibrated sport-specific agents only after enough independently verified history exists. For truly live odds, add licensed streaming/websocket providers and a distinct hot path instead of overloading the scheduled analytics bots.