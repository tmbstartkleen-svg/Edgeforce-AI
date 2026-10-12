# Stable credentials for isolated Cloudflare D1 Worker

The D1 pilot deploy workflow previously generated two new random secrets on **every** deployment and uploaded them via two separate Wrangler secret operations. The independently published Worker versions can cause temporary HTTP 401 responses during hosted read/write certification and make future scheduled collectors lose access.

## Configuration (required before automated collection)
Create the following GitHub Actions repository secrets in `tmbstartkleen-svg/Edgeforce-AI`:
- `D1_PILOT_CRON_SECRET` — unique high-entropy secret of at least 32 characters
- `D1_PILOT_INGEST_SECRET` — different high-entropy secret of at least 32 characters

Keep them outside the repository. Once configured, GitHub Actions deploys the same secrets on each release. The workflow checks that both secrets are distinct and long enough. If either is absent, the workflow **continues generating a temporary secret**, masks it, and warns; this remains safe for isolated deployment smoke tests but **is not suitable for a durable scheduled collector**.

The flags `SPORTS_SCORE_COLLECT_ENABLED`, `SPORTS_D1_WRITE_ENABLED` and `INTELLIGENCE_D1_WRITE_ENABLED` stay false. Stable credentials do not authorize any source, establish usage rights, or turn on ingestion.

Do not enable automated collection until provider authorization, source registry entry, bounded scheduling, D1 hosted readback, and freshness evidence are verified.
