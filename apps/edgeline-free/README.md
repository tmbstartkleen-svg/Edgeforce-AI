# Edgeline free-mode dashboard

Independent deployment: https://edgeline-free.tmbstartkleen.workers.dev/#monitoring

This static Next.js export replaces the paused AppDeploy dashboard for free-mode research. It does not alter the existing EdgeForce Worker. The Worker only handles on-demand public-data reads; no secrets, database bindings, schedules, trading, paid collectors, or archive writes are configured. Billing was not changed; OAuth cannot read account subscriptions, so current billing details are not independently verified. Static assets are free; API requests remain subject to the existing account's Workers plan and quota.

## Run and validate

```
npm ci
node verification/check.cjs
node verification/free.cjs
npm run build
wrangler deploy --dry-run
```

Deploy manually with an authenticated Wrangler installation using `wrangler deploy`. No automated deployment or paid upgrade is configured.

## Learning

Research lab checks five current-season soccer result files on use. Successful imports are cached in browser IndexedDB for 24 hours. Explicit historical import covers five leagues across six seasons. Each day's forecasts use only earlier dates; results are deduplicated by game identity and corrections replace each partition. Computation runs in the browser, not metered server compute. No automatic live-model promotion occurs. Brier/log-loss comparisons are historical replay, not live profitability evidence. IndexedDB is local to this origin/device; export research to retain a backup. Old AppDeploy paper tickets are not migrated.

## Coverage and limitations

Public Kalshi series and Polymarket competition catalogs are cached for 15 minutes, event pages for one minute, errors briefly. Full cursor pagination is supported. Catalog size is not live-game count. Odds are indicative snapshots, not executable prices or forecasts. DraftKings/FanDuel automatic collection is disabled; schedule, ticket and simulation tabs therefore have no new sportsbook inputs. Injuries, rosters and all-sport independent models remain unverified.

## Verified October 27, 2026

- Production build, type checks, Worker dry run and both regression suites passed.
- New host rendered Monitoring and returned all paid/archive/scheduled flags false.
- Browser learning imported 394 completed matches; 90 eligible comparison games. Market Brier 0.5329, Poisson 0.6113, Monte Carlo 0.6118. This sample favors the market benchmark.
- Polymarket catalog: 491 entries; EuroLeague inspection: 21 events / 66 markets (including futures, not 21 live games).
- Kalshi returned HTTP 429 and was displayed as unavailable rather than fabricated coverage.
