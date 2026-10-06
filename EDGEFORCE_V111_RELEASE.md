# Edgeforce V111 — Provider + Vercel Deployment Recovery

V111 continues production closure after V110 cleared the historical database and legacy SLO-bootstrap boundaries.

## Verified V110 production findings

- main verification passed.
- Cloudflare migrations completed through v114.
- Cloudflare Worker deployment succeeded and produced a healthy V110 runtime.
- Cloudflare then failed at live sportsbook provider certification with HTTP 422.
- Vercel passed the repaired pre-V74 SLO gate and captured a legacy production baseline from V23.
- the Vercel prebuilt artifact itself built successfully.
- Vercel deployment was rejected because the connected project is on a cron-limited plan while `vercel.json` registers sub-daily jobs.

## V111 repair contract

### Vercel deployment without duplicate cron registration

Cloudflare already owns the high-frequency Edgeforce scheduler. V111 keeps all cron API routes in the Vercel runtime, but before the prebuilt Vercel artifact is uploaded it removes cron registration from the CI workspace and Build Output configuration.

This avoids requiring a Vercel plan upgrade and prevents duplicate scheduled execution across Vercel and Cloudflare.

The source `vercel.json` remains unchanged in the repository so the route/schedule specification stays documented, while the production Vercel deployment artifact omits unsupported cron metadata.

### Real sportsbook provider recovery

The Odds API live board now has a bounded recovery path:

1. try the configured multi-bookmaker upcoming feed.
2. if the provider rejects that request with HTTP 400/422, or returns an empty 200 response, retry the real provider with a conservative `regions=us&markets=h2h` baseline.
3. keep DraftKings/FanDuel and expanded full-slate logic after a successful bootstrap.
4. never synthesize demo odds when the provider is unavailable.

### Provider diagnostics

HTTP provider errors now preserve a bounded upstream response detail instead of only reporting `HTTP <status>`.

Both production workflows now print the provider certification JSON before failing, including:

- launch-ready status
- capability coverage
- provider HTTP status
- row and normalized-market counts
- quota information when available
- provider rejection reason

This means a remaining key/quota/account/provider failure is actionable on the next run instead of opaque.

## Identity

- build: V111
- app: 111.0.0
- package: 0.111.0
- model: edgeforce-v111
- migration: v114 (unchanged)
