# EdgeForce specialist team network (Build 406)

## Working slice

- Browser route: `/team`
- Server research endpoint: `POST /api/team/research` with `{"question":"..."}`
- Read-only configuration endpoint: `GET /api/team/research`
- Research roles: Scout (coverage), Lines (provisional price comparisons), Props (player-market coverage), Arb (matched arithmetic), Audit (quality), Captain (coordination).
- The bots operate as deterministic evidence-focused roles in this release; this is **not yet an autonomous LLM agent runtime**.
- Each submitted question creates one research round using the existing `ingestOdds()`, `scanEdgeOpportunities()`, and `auditMarketBatch()` code paths. Role messages include provenance and limitations.
- The chat displays shared team findings, allows viewing one role at a time, and stores the last twelve rounds only in the browser's localStorage. No cross-device session persistence, agent-to-agent WebSocket messages, or production authenticated user sessions are claimed.
- The source inventory reflects market selections observed in the provider, **not** every sport and market offered by DraftKings. Limited feeds and quotas can omit leagues, markets or distant start times.
- A sharp-book/consensus-derived reference is not an independent probability model. Output always sets `independentModelVerified=false`, `quoteFreshnessVerified=false`, `actionableBetRecommendations=false`.
- Stored or demo quote snapshots cannot be promoted to executable arbitrage.

## Gap between current code and finished platform

| Capability | Current status | Completion criteria |
| --- | --- | --- |
| Unified all-sport +EV board | Existing provisional board | Prove independent calibrated model estimates, quote-level freshness and exact-market identity |
| World-league coverage | Quota-limited observation | Obtain licensed provider coverage inventory; enumerate available sports/leagues/market types/time ranges, including tennis/soccer/college sports |
| Arbitrage | Snapshot scanner | Confirm all legs/execution limits, venue rules, book eligibility, stale-line filtering, and fees |
| Player trends | Some player props/contexts exist | Verify stat feeds, injury/lineup timestamps, sample sizes and stat mappings for each league |
| Live scanning | Existing ingest plus opportunistic panels | Contracted low-latency feed with push/WebSocket where allowed and rate/latency SLAs |
| Agent collaboration | Six evidence-based specialists | Wire Cloudflare Agents SDK, durable room, LLM reasoning tools, agent-to-agent tasks and audit trail |
| User questions | Text questions and role responses | Contextual follow-ups, deeper per-event investigations, memory with authenticated identity |
| User bankroll/boost | Existing EdgeForce components | Validate stake sizing and profit-boost rules before surfacing an actionable wager |
| Outcome tracking | Existing prediction/settlement system | Longitudinal model calibration, CLV capture and verified realized profit / loss |

## Future agent runtime

Cloudflare Agents SDK fits the deployed Workers architecture; migration must add:
1. `agents` dependency and Durable Object bindings/migrations without modifying previous migration tags.
2. A persistent private TeamRoom agent with `AIChatAgent`/callable tools, identity authorization, WebSocket streaming, thread histories and source snapshots.
3. Specialist tool registry with user-visible tasks: sport discovery, market quote comparisons, stats, news/injuries, weather, line movements, simulations, settlement and source-health audit.
4. Agent collaboration as asynchronous durable workflows or queued tasks, not free-running infinite loops. Fan-out/fan-in with timeouts, quotas, source citations and reviewer consensus; ask human questions when critical data is missing.
5. Rate limits, budgets, model safety, provider credential isolation, anti-prompt-injection checks, and a user-visible agent activity log.
6. Real coverage audit comparing source-reported sports/markets and accessible DraftKings book availability. Missing data must be displayed, not synthesized.

## Data and compliance

Only fetch through authorized/licensed APIs. Avoid DraftKings website scraping, account bots and automatic wagering. Access and collection restrictions may vary by jurisdiction and API contract; verify rights before expanding feeds.

Sports betting returns are uncertain. The software must distinguish a value estimate from measured positive return and should never label a market-reference model output as a verified edge.

## Local review

```bash
npm run test:team
npm run typecheck
npm run lint
```

`npm run verify` also runs the new regression tests; full production acceptance still requires live feed/provider validation and Cloudflare deployment smoke tests.
