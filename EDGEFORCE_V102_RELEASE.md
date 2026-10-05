# Edgeforce V102 — Cloudflare Hosted Preview Parity

V102 removes the gap between the certified GitHub Cloudflare build and the hosted PR preview path.

## What changes
- PRs build the same Vinext artifact used by production deployment.
- Hosted previews use Cloudflare's supported Wrangler Preview flow.
- The preview deploys from generated `dist/server/wrangler.json`, whose entry point is `index.js`.
- Preview base configuration is ignored so dashboard drift cannot silently change the artifact contract.
- Hosted preview health/version/model identity is smoke tested.
- Preview build JSON and build logs are retained as GitHub artifacts.
- PR close events delete the named Cloudflare Preview.
- Production Cloudflare builds use `pipefail` so a failed build cannot be hidden by `tee`.

V102 does not change prediction models, betting thresholds, bankroll policy, or recommendation logic.
