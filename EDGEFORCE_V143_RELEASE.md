# Edgeforce V143 — Certified Release Backlog and Safe Catch-Up

V143 closes the gap between GitHub certification and the Vercel production alias.

The exact current main SHA must now pass both Verify Edgeforce and Verify Edgeforce Cloudflare on main before the team governor may treat Edgeforce as release-eligible. Pull-request evidence alone is not sufficient. The Cloudflare verifier therefore gains a main-branch push trigger so squash-merge commits receive exact-SHA Cloudflare evidence.

The hourly governor compares the live production SHA with main, measures backlog depth and age, reads recent main workflow evidence, and identifies the newest exactly certified commit. Edgeforce catch-up remains fail-closed when the current head is uncertified, certification evidence is missing, or the compare window is truncated.

When the exact current main SHA is certified and V142 allocates Edgeforce a normal slot below the 84-slot automation cap, the governor dispatches the existing guarded production workflow. That workflow still performs its own production certification and Vercel budget gates before any upload or promotion.

V143 also exposes backlog depth, certified depth, oldest waiting age, live/head/newest-certified SHAs, exact-head certification state, and catch-up eligibility in the operations dashboard. Migration v118 persists backlog snapshots for durable release-lag history.
