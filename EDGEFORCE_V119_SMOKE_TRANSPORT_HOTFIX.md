# V119 hotfix: bounded, status-aware smoke transport

## Observed failure

Main commit 12dc187c5cc75c6bb556c7eee5e14afb1230b082 passed Cloudflare production run 37469597111. Vercel production run 37469596925 passed compilation, 12 runtime regression tests, migrations, 935 release audit checks, local smoke/load, exact hosted identity, provider certification and strict launch doctor, then stopped when `vercel curl` returned code 35 (connection reset) while reading `/api/intelligence/ml-tournament`.

## Repair

- Retry only recognized transient GET transport failures, up to three attempts with short bounded backoff.
- Limit curl connection time to 10 seconds, request time to 30 seconds, and CLI process time to 45 seconds. Bound native fetch and body consumption with a 30-second abort signal.
- Capture the actual HTTP status instead of treating every protected response as HTTP 200.
- Keep response bodies separate from CLI stderr. Do not echo child-process error objects that could contain protection credentials.
- Do not retry HTTP/authentication failures, malformed status framing, certificate validation errors or JSON/schema assertion failures.
- Preserve every existing endpoint contract and explicit degraded-data contract, plus the strict SLO, canary, V1 and production promotion gates.
- Run ten transport regression tests after every typecheck, alongside the twelve existing runtime repair tests.

No runtime version bump, migration change, provider quota change, production-gate bypass or claim of full simulation availability is included. Production completion still requires successful hosted verification and promotion on the exact merged commit.
