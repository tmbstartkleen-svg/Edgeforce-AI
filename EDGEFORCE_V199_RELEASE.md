# V199 — observation continuity and provider diagnostics

V199 makes the sportsbook observations recovered in V198 more complete and resilient. It preserves completed source results when another source or the model pipeline fails, exposes collection coverage, and records the evidence needed to distinguish provider transport, authentication, quota and response failures.

## Collected prices remain accessible

The public reference projection now returns up to 1,000 already-collected quotes, replacing the former 200-quote cap. When that limit is reached, return slots are shared across sports before the selected rows are sorted by event time. Earlier games in one busy league cannot consume the entire response. The browser no longer applies its own 200-row cutoff; sport and market filters and 25-row progressive display operate on all supplied quotes.

Coverage metadata reports eligible collected quotes, returned quotes, omissions caused by this response limit, and per-sport quote and source-event counts. If an earlier source snapshot was truncated, that loss is explicitly marked as unknown rather than reconstructed by summing overlapping counts. These counts describe acquired observations; they never claim complete league, bookmaker or full-slate coverage. The display distinguishes returned rows from observations that have expired or whose events have started.

Duplicate/conflict resolution occurs before the final cap. A withheld conflict cannot consume a return slot, revive an older price, or hide a later unaffected selection. Equivalent scheduled instants are normalized to the same timestamp. Reference observations still expire after five minutes or event start, retain their original observation time, contain no model probability, EV, staking or consensus fields, and cannot satisfy certified ODDS readiness.

## Bounded collection with partial results

The scoremesh shares one acquisition promise across concurrent callers. It uses a 4.5-second default batch deadline and at most six concurrent primary source requests. Every completed scoreboard is immediately available through an age-filtered cache reader. Previously deferred sources receive the next opportunity; a cold start interleaves sport families. Primary scoreboards precede optional game detail and backups, and the formerly unbounded CDN detail fan-out now has a 12-request cap.

Each configured primary source reports whether it was fetched, reused from cache, failed or deferred, with its original observation time and acquired counts. Failed or unfinished sources do not erase another source's completed data. Successful authoritative empty boards clear their prior observations. Backup timeouts preserve primary results. Cached publication and quote timestamps are not renewed by reads.

The separate ESPN odds adapter now has a five-second default shared deadline, bounded parallel requests, first-day scoreboard opportunities before tomorrow/Core fallback, and fair Core fallback allocation. Its existing Cloudflare defaults of two leagues and eight requests remain in place. Completed date-window observations survive other source failures only within the five-minute evidence limit. A newer event revision supersedes an older retained copy when adjacent date windows overlap. V198 contract parsing and reference-only provenance remain intact.

## Independent observation and model availability

`/api/live-board` publishes the `edgeforce-live-board-v199` schema and an explicit `coreStatus`. An ingestion timeout, ingestion exception or downstream scanner/ranking exception returns a structured HTTP 503 with empty model rows and the current independent score, reference-odds, pulse and prediction-source results that were successfully acquired. Provider reference observations and diagnostics also survive a downstream model failure.

The dashboard accepts this precise degraded contract while keeping model rows, drilldowns, scanner actions, parlays and portfolio actions unavailable. Observation-response age is evaluated separately from model-core availability. A successful response containing no eligible sportsbook markets uses `NO_ELIGIBLE_MARKETS`; `READY` means the model-data pipeline has inputs, not that an independent model edge or recommendation has been certified. No additional polling loop is introduced, and an unavailable core retains at least the existing 1.5-second retry delay.

The live-data status route can reuse the same isolate's cached score observations without issuing additional score requests. It exposes observation availability separately from normalized-market availability.

## Provider failures retain their evidence

The Odds API adapter records fixed, redacted diagnostic fields for free preflight, paid requests and requests blocked before dispatch. Actual HTTP status exists only after an HTTP response arrives. Transport errors and opaque status-zero responses do not become invented upstream HTTP errors. Request and body timeouts, authentication failures, rate limits, quota exhaustion, redirects, invalid JSON/payloads and body failures are distinct.

Received quota headers survive body/JSON failures. A later paid-request transport failure invalidates the current balance even if preflight headers were known. Cached quota evidence retains its original observation timestamp and is labelled cached. Arbitrary error text, response bodies, URLs and credentials are excluded; provider error and transport codes use allowlists. Successful bodies are bounded to 4 MiB and error bodies to 16 KiB. Redirects remain unfollowed. No retries, paid refresh acceleration or authentication changes are introduced.

Diagnostics propagate through provider attempts, certification, status and the existing provider-details panel. Credit continuity uses explicit quota/reserve/unverified-credit evidence; the phrase "quota preflight" in a network error no longer implies exhausted credits. The release audit verifies the structured error-code preservation and credit-policy gate instead of obsolete message text. Free preflight and the configured reserve still precede every paid request. The guard remains local to an account within one runtime isolate, not a distributed reservation.

## Verification

The final local tree passed TypeScript, 630 core tests, 129 odds-recovery tests and 80 research-pipeline tests. The production Next build, migration validation and release audit passed. Lint reported zero errors and the same 19 existing warnings. The production-build smoke suite passed 51 checks. The 60-request health/deployment-endpoint load check had zero failures and a 110 ms p95; that metric does not measure sportsbook acquisition latency.

A separate public-feed probe through the production build with production data mode enabled returned 226 DraftKings reference quotes from both `/api/live-scores` and `/api/live-board` on November 25, 2026 at approximately 06:02 Eastern. It included 54 NBA quotes across nine source events, 46 NCAAB quotes, six NFL quotes, 84 NHL quotes and 36 UCL quotes, with no response-limit omissions. The score call took 4,524 ms and the board call 5,485 ms. Source collection remained partial, bookmaker update timestamps were unavailable, and the board correctly returned zero model rows with `NO_ELIGIBLE_MARKETS`. This is point-in-time local production-build evidence, not hosted production proof or betting-performance evidence. The paid Odds API key was disabled only in this local validation subprocess.

Hosted smoke now checks both the score API and the actual dashboard board API, validates observation boundaries and coverage counts, and records actual collection/core status. Accepted degraded recommendation endpoints are explicitly labelled in the report. An empty reference snapshot remains valid only when honestly reported; the release does not guarantee a complete live slate or fix an external provider's access or balance.

Cloudflare remains automatic production primary, with Vercel as manual standby. V199 is a feature milestone; runtime version remains `119.0.0` / `edgeforce-v119`. Credentials, schemas, paid plans, collector schedules and betting authorization are unchanged. Deployment closure is separate from recommendation readiness.
