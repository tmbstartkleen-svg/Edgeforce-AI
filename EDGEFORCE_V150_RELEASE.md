# Edgeforce V150 — Certified Final-Score Settlement Evidence

V150 connects the V148 live-score consensus layer directly to automated wager settlement so conflicting or weak final-score evidence cannot silently grade fallback wagers.

## What changed

- Adds an explicit settlement-evidence policy for final-score fallback.
- Accepts HIGH and MEDIUM cross-source final-score consensus when no active contradiction remains.
- Allows trusted primary single-source finals from NHL Web, MLB StatsAPI, ESPN CDN, and ESPN Public only when no contradictory evidence is present.
- Blocks unresolved score/status conflicts, LOW-confidence finals, incomplete scores, non-final games, and untrusted single-source finals.
- Adds accepted/blocked final-game counts plus confidence, conflict, and trusted-single-source breakdowns to automatic settlement telemetry.
- Surfaces blocked settlement reasons as bounded warnings rather than silently grading questionable evidence.
- Adds deterministic unit and runtime regression coverage for corroborated acceptance, conflict blocking, untrusted single-source blocking, and fail-closed incomplete/non-final behavior.
- Advertises the certified settlement gate through health, smoke, and release-audit contracts.

## Safety policy

Provider-native result rows remain the preferred settlement source. The live-score mesh remains a fallback. V150 makes that fallback stricter: ambiguous or contradictory evidence is withheld rather than guessed.

Cloudflare remains the production primary and Vercel remains a manual-only disaster-recovery standby.
