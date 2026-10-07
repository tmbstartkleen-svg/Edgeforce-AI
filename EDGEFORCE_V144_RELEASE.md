# Edgeforce V144 — Cloudflare Primary, Vercel Standby, Free-First Sports Mesh

V144 moves Edgeforce production to Cloudflare Workers as the automatic primary while retaining Vercel as a manual disaster-recovery standby.

Cloudflare production now waits for both exact-main certification workflows — Verify Edgeforce and Verify Edgeforce Cloudflare — before building or deploying the Worker. The Vercel production workflow is workflow-dispatch only, and the team governor marks Edgeforce autoRelease=false so hourly capacity recovery cannot silently dispatch another Vercel production release.

Sportsbook provider availability is separated from platform availability. The Odds API and SportsGameOdds are optional runtime secrets. Provider certification may report recommendationReady=false or HTTP 422 without failing the Cloudflare platform deployment. The strict Cloudflare launch doctor uses platform mode, while recommendation APIs continue to fail closed whenever normalized real sportsbook markets are unavailable.

The free-first sports-data mesh combines the existing ESPN public feeds, ESPN Core odds, Kalshi, Polymarket, FanDuel pulse, native MLB/NHL feeds and SportScore with new optional score backups:
- TheSportsDB shared free v1 key for schedule/result redundancy.
- football-data.org when FOOTBALL_DATA_API_KEY is configured.
- API-Sports when API_SPORTS_KEY is configured, with conservative cached endpoints.
- Big Balls Sports Data when BIGBALLS_API_KEY is configured.
- SportsGameOdds when SPORTS_GAME_ODDS_API_KEY is configured.
- The Odds API remains optional overflow/reference capacity when credits are available.

The added score providers use bounded caching so free request limits are not treated as unlimited. Missing optional credentials disable only that source; they never block Cloudflare production.

No database schema migration is required by V144. Existing migration identity remains v118.
