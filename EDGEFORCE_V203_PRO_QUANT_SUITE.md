# EdgeForce V203 Pro Quant Suite and private AI analyst

V203 introduces native, modular price research, sportsbook +EV math, portfolio ROI and CLV, historical NFL EPA, and a provider inventory. Data entered in these tools is not an independently verified trading quote.

## Quant workspaces

- Price & +EV Lab: matched two-way no-vig prices, hold, fair price and reference vs independently modeled EV; requires verified odds outside the manual UI.
- Bankroll / CLV: simple CSV input fields id, date, sport, selection, book, stake, odds, closingOdds, result. Computes settled ROI, P&L, win rate and line movement. Browser session state only; no server persistence.
- NFL EPA: pasted historical play-by-play with posteam, epa, play_type, success. Calculates descriptive EPA/play, success rate and pass share. NFLverse data is available separately under public terms.
- Data & Partners: clearly distinguishes public prediction market read APIs, bookmaker aggregators with possible issued credentials, and license-required Opta, Hudl and Catapult sources.

## Optional Vercel AI Gateway analyst

Server configuration is opt-in: AI_GATEWAY_API_KEY (secret), AI_GATEWAY_MODEL (real provider/model ID from current catalog), and EDGEFORCE_ANALYST_ACCESS_TOKEN (private operator token at least 32 characters). Add credentials in encrypted Cloudflare Worker configuration only. Do not commit, paste, log, or embed credentials in client code.

The operator enters a separate access token on a trusted device for an individual manual analysis. It is not persisted in localStorage. The backend validates prices, recalculates deterministic fair-value evidence and sends only bounded data through the official AI Gateway REST Chat Completions endpoint. It does not assert live game facts or bet execution.

A PostgreSQL-locked quota is mandatory for outbound AI calls: maximum 12 attempts per UTC day, plus a shared 90-second cooldown. Calls count before requesting the provider, even when a gateway call fails. When the quota database is unavailable the endpoint fails closed. All model calls are manually requested; no automatic cron, background spending, brokerage integration or trading automation is added.

## Source and license boundaries

Mathematics, simulation, price comparisons, ROI/CLV and analytics interfaces can be built directly. Official coordinates, exclusive Opta/Genius/Sportradar tracking, Hudl footage, Catapult biometrics, verified sportsbook markets, and private Kalshi trading permissions cannot be created by software. They require legitimate licensed or authorized source access.

Cloudflare remains primary. Vercel remains manual-only standby. This branch does not configure secrets, buy subscriptions or deploy production.

Sources: https://vercel.com/docs/ai-gateway/openai-compat/rest-api and https://github.com/nflverse/nflverse-data