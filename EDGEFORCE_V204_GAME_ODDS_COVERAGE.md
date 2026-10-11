# EdgeForce V204 — Games & Schedules price coverage repair

## Why the screen showed 'Odds not supplied'

The Games workspace historically read sportsbook prices only when ESPN returned complete odds nested inside a schedule event. It did not reuse the normalized odds history that EdgeForce's separate odds ingestion saved. As a result, a game could have a real quotation elsewhere yet show no quoted odds here.

## Implemented

- Adds a separate read-only stored-price API (max 900 snapshot rows, 30-minute lookback, 60-second short-lived application cache). No extra external API or bookmaker calls.
- Games & Schedules requests that endpoint independently so provider/DB failure cannot suppress the ESPN schedules.
- Joins using the exact sport/league, matching home and away teams, kickoff within eight minutes, future/pre-game state, known bookmaker, valid American price, native quote source timestamp present, and observation age under ten minutes.
- Shows accepted historical bookmaker prices as indicative research only. Does not classify them as current executable orders. Reuses ESPN odds when present rather than replacing an identical book line.
- The previous generic message now distinguishes no connected source quote, stale/rejected matching quotations, and unavailable stored market history. Partial provider coverage details are visible under the schedule coverage section.
- Does not infer player props, contract equivalence or SGP prices; only moneylines, spreads and game totals are eligible for this overlay.

## What V204 does NOT fix

**One accepted of one configured sportsbook-odds upstream** is a *real missing provider configuration*. ESPN scores, Google Sports/SerpApi, and API-Football do not count as independent bookmaker odds feeds. A real API key for an authorized second source must be installed in Cloudflare Worker Secrets; its accepted status depends on actual provider responses and sufficient independent bookmaker data.

A database snapshot may be older than the price available to the user at DraftKings. Visible lines are for researching game markets, not live trade approval. Quote age is computed conservatively and older observations are rejected, not reconstructed.

## Testing

Automated tests reject NFL/NCAAF mismatches, team and time mismatches, missing/stale/future timestamps, invalid odds, unknown bookmakers and unsupported player props, while preserving distinct bookmaker prices and ESPN originals. CI and hosted preview are required before merge. Cloudflare production remains primary; Vercel remains standby/manual only.