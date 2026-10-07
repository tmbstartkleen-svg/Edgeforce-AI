# Edgeforce V149 — CI Convergence and Superseded-Run Control

V149 fixes the GitHub Actions runner pileup that could make Edgeforce appear stuck even when the code itself was healthy.

## What changed

- Adds per-PR/per-ref concurrency groups to Verify Edgeforce, Verify Edgeforce Cloudflare, and Edgeforce Cloudflare Hosted Preview.
- Sets `cancel-in-progress: true` for PR validation so a new commit cancels obsolete checks from the same workflow instead of stacking them.
- Keeps the production Cloudflare deployment serialized with `cancel-in-progress: false`; production release safety is unchanged.
- Uses `npm install --no-audit --no-fund` because this repository does not currently contain a `package-lock.json`; CI deliberately avoids lockfile caching that would fail before tests start.
- The regression suite requires this lockfile-safe fallback until a real committed lockfile is introduced.
- Pins checkout, setup-node, and upload-artifact actions to reviewed immutable commit SHAs.
- Adds hard execution ceilings: 30 minutes for full verification, 25 minutes for Cloudflare verification and preview, and 10 minutes for preview cleanup.
- Adds mandatory static regression coverage that fails if concurrency cancellation, deterministic installs, action pins, timeouts, or production serialization regress.
- Advertises the V149 controls through health and smoke contracts.

## Operational result

Only the newest validation run for a PR/ref should remain active after future branch updates. This prevents repeated edits from consuming multiple runners with stale work and removes the main source of the monitoring/queue jam seen during V147–V148.

Cloudflare remains the production primary. Vercel remains a manual-only disaster-recovery standby. V149 does not enable automatic standby promotion or change production routing.
