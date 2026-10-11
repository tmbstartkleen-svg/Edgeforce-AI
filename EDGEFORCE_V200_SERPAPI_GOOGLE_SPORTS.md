# V200 — SerpApi Google Sports research

Adds an opt-in, cache- and quota-protected Google Sports **research** module beneath Games & Schedules. It is a SerpApi intermediary that collects Google's sports results, NOT an official unlimited Google API and NOT a sportsbook odds feed. It does not resolve the existing one-odds-provider warning.

## Set up Cloudflare Worker securely

1. Create an account at https://serpapi.com and get the private API key. The published free plan provides 250 searches/month.
2. Under Cloudflare > Workers & Pages > edgeforce-ai > Settings > Variables and Secrets, add the encrypted secret SERPAPI_API_KEY with the vendor-issued key.
3. Add the non-secret variable SERPAPI_SPORTS_ENABLED=true.
4. Add the non-secret variable SERPAPI_SPORTS_TARGETS_JSON containing verified league Knowledge Graph IDs, e.g.:
   [{"id":"laliga","name":"La Liga","kgmid":"/m/09gqx","sp":"ft"},{"id":"premier-league","name":"Premier League","kgmid":"/m/02_tc","sp":"ft"}]
5. After the reviewed V200 code is deployed, open Games & Schedules and click Load Google Sports research.

The documented sport codes are ft (football/soccer), bs (basketball), bb (baseball), cr (cricket), af (American football), ih (ice hockey), and rg (rugby). Verify league KGIDs through the provider playground before adding NFL, NCAA, NBA or other competitions. The adapter accepts up to eight validated league targets and rotates among them. No league identifiers for these other sports are invented by EdgeForce.

## Shared free-tier budget

One global PostgreSQL-locked request slot per 8 hours, with a conservative cap of 90 attempted searches per UTC calendar month. The cap is per credential across Cloudflare/Vercel if both share the same database. Failed requests still count as attempted for our quota safety. If database or key access fails, no SerpApi request is sent. The response is cached until the next 8-hour slot; React does not auto-poll it. This internal quota cannot account for usage in other apps sharing that credential.

## Safety and provenance

The API returns the search observation timestamp from search_metadata.created_at and order-neutral teamA/teamB labels. SerpApi does not verify home/away team order in the sample used. Its own scraping timestamp is not a timestamp of the game's latest play, so EdgeForce does not merge these snapshots into high-speed live scores, betting market consensus, model certainty, sportsbook odds, EV rankings, or actual parlays. This adapter adds no new sportsbook provider and never bypasses single-source odds warnings.

No production secrets, subscriptions, or order execution are changed by V200. Cloudflare remains primary; Vercel remains standby/manual-only. Hosted preview must pass before any production merge.

References: https://serpapi.com/google-sports-api , https://serpapi.com/pricing , https://serpapi.com/account-api .
