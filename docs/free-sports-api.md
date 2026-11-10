# Free sports gateway

The localhost gateway from PR #499 is included as an isolated tool. It is not a
production collector and is not connected to the research route, dashboard,
cron jobs or D1. No credential is included. No current provider connection or
complete league coverage is certified by this integration.

`npm run serve:free-sports` listens on `127.0.0.1:8788`. Set a separate operator
token of at least 24 characters in `FREE_SPORTS_API_TOKEN`; optionally select a
port with `FREE_SPORTS_API_PORT`. All routes require that bearer token.

The local `coverage` route reports configuration, disabled collection,
unverified connectivity and the single-process quota scope. Credentials alone
do not enable upstream requests. Both `BETSTACK_API_KEY` and the explicit
`FREE_SPORTS_API_ENABLE_UPSTREAM=true` opt-in are required before data routes
can contact the provider. That opt-in has not been enabled by this change.

| Local GET route under `/api/sports/v1/` | Purpose |
| --- | --- |
| `coverage` | Local configuration; no upstream request |
| `sports` | Upstream sport catalog |
| `leagues` | Upstream league catalog |
| `events` | Events with validated optional league/date filters |
| `results` | Upstream results collection |
| `lines` | Consensus prices; no executable sportsbook claim |
| `teams` | Upstream team collection |

Filter allowlists, date validation, bounded responses, request timeouts and
redirect rejection are enforced by the adapter. Returned event rows must honor
requested league and UTC date filters. Catalog authentication alone does not
prove schedule accuracy. Other resource filter contracts still need live review.

All endpoints in one process share a 60-second request interval and a bounded
60-second cache. The interval is reserved before fetching, including failures.
Upstream rate-limit responses can extend the cooldown. This is not durable or
distributed: other instances, collectors and process restarts can bypass its
local state. Production activation requires shared durable per-key quota state
and independently verified schedules, response contracts and prices.

Retrieval time is never labeled as source quote time. Lines are explicitly
consensus observations, not DraftKings selections or independent model outputs.
The adapter does not supply injury verification, forecasts, all-sport coverage,
archive writes or betting actions.

Run `npm run test:research-pipeline` to check the integration with mocked fetches.
These tests do not spend provider credits or demonstrate live data quality.
