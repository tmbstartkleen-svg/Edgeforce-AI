# Edgeline free-tier analysis dashboard

Live: https://edgeline-free.tmbstartkleen.workers.dev/#board

Independent static Next.js deployment; the existing EdgeForce Worker is unchanged. The dashboard connects real DraftKings prices through The Odds API and compares matching markets with other books. Select an active league or the provider's next-eight-games feed. Catalog inclusion does not guarantee DraftKings coverage.

## Free-credit protection

A single SQLite Durable Object coordinates all users and persists the latest snapshot per league and its credit counter. Reservations occur before requests, including failed requests. Concurrent visits cannot spend separate credits for the same refresh. Limits: 3 refreshes per UTC day, 300 reserved credits per calendar month, 30-minute global cooldown, 3 credits reserved per refresh. The free sports-catalog endpoint verifies remaining provider credits before collection, maintaining a 10-credit reserve. Unknown quota fails closed. The provider's remaining-credit header also accounts for use outside this app. Successful snapshots can refresh on use after six hours; there are no background alarms or cron jobs.

Only THE_ODDS_API_KEY is stored as a Worker secret. No keys are sent to the browser. Paid odds flag, D1 archive writes and ATLAS scheduling remain false. No subscriptions or billing settings were changed. The connected OAuth session cannot independently inspect billing. SQLite Durable Objects are available on Workers Free; account-wide runtime quotas still apply.

## Analysis integrity

Quotes older than five minutes are excluded from ready cards and arbitrage. Historical snapshot parlay constructions remain visible with a warning and disabled slip loading. Market-implied Monte Carlo probabilities are not independent forecasts. Negative differences against the market estimate are labeled as having no positive price edge. Injuries, lineups and all-sport independent forecasts remain unverified.

Arbitrage scanning currently compares DraftKings and FanDuel full-game moneylines only, with identical outcome sets, fresh prices and future start times. Results are theoretical candidates requiring settlement-rule, limits and executable-price confirmation. Exchange contracts, spread/total arbitrage and fee-adjusted execution are excluded. Zero candidates is a valid result, not an error.

## Learning and monitoring

Research lab checks completed results from five soccer leagues on use. Successful imports are cached in browser IndexedDB for 24 hours. Forecasts use earlier dates only; corrections replace partitions and duplicates do not multiply training games. This is historical replay, not live profitability evidence. Export research to retain a backup; browser data is local to this device/origin. Old AppDeploy paper tickets are not migrated.

Monitoring shows API health and paid/free collection flags. International coverage provides cached public Kalshi and Polymarket catalogs and paginated event inspections with source status and capture times. Catalog counts are not live-game counts.

## Validation and deployment

```
npm ci
node verification/check.cjs
node verification/free.cjs
node verification/odds.cjs
npx tsc --noEmit --target es2022 --module esnext --moduleResolution bundler --lib es2022,dom --skipLibCheck --strict worker/odds.ts worker/index.ts backend/normalize-odds.ts
npm run build
wrangler deploy --dry-run
```

Store THE_ODDS_API_KEY using Wrangler secret input, then deploy with `wrangler deploy`. No automatic deployment or paid upgrade is configured.

Live verification October 28, 2026 at 10:57 UTC: 8 upcoming matches, 16 DraftKings selections, 478 provider credits remaining, 3 app credits reserved, no provider error, 0 qualifying arbitrage candidates. These are snapshot results, not permanent counts. Browser verification confirmed populated parlay builders and timed candidate cards. Prior learning verification imported 394 matches with 90 eligible model comparisons; the market benchmark outperformed the Poisson model in that sample.
