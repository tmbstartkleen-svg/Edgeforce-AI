#!/usr/bin/env bash
# Authorized one-time REAL scoreboard certification, isolated pilot ONLY.
# Run in the Edgeforce-AI repo with Wrangler OAuth logged in.
set -euo pipefail
cd "$(dirname "$0")/.."
[[ "${EDGEFORCE_ISOLATED_INGEST_APPROVED:-}" == "yes" ]] || { echo 'Explicit staging authorization required' >&2; exit 1; }
unset CLOUDFLARE_API_TOKEN
[[ -f wrangler.d1-pilot.jsonc ]] || exit 1
secret=$(security find-generic-password -a "$USER" -s edgeforce-d1-pilot-cron -w)
[[ "${#secret}" -ge 24 ]] || { echo 'Pilot secret unavailable' >&2; exit 1; }
sport="${EDGEFORCE_CERT_SPORT:-nhl}"
[[ "$sport" == "nhl" || "$sport" == "nba" ]] || { echo 'Only NHL or NBA approved for this test' >&2; exit 1; }
config=".edgeforce-isolated-cert-$$.jsonc"
restore_needed=0
cleanup() {
  code=$?
  trap - EXIT INT TERM
  if [[ "$restore_needed" -eq 1 ]]; then
    echo 'ROLLBACK: redeploy isolated pilot with ALL writes/collection disabled.'
    if ! npx wrangler deploy --config wrangler.d1-pilot.jsonc --keep-vars; then
      echo 'CRITICAL: rollback deploy failed. Manually disable both staging flags immediately.' >&2
      code=1
    fi
  fi
  rm -f "$config"
  # Confirm disabled on authenticated pilot; never echo the secret.
  if [[ "$restore_needed" -eq 1 ]]; then
    echo 'Checking rollback flags...'
    if ! EDGEFORCE_PILOT_CRON_SECRET="$secret" node --input-type=module -e '
const x=await fetch("https://edgeforce-d1-pilot.tmbstartkleen.workers.dev/api/operations/d1-pilot/score-collector-readiness",{headers:{Authorization:"Bearer "+process.env.EDGEFORCE_PILOT_CRON_SECRET},signal:AbortSignal.timeout(15000)}).then(r=>r.json());
if(!x.ok||x.flags?.collectionEnabled!==false||x.flags?.d1WriteEnabled!==false)process.exit(1);
console.log("ROLLBACK VERIFIED: both staging flags false.");'; then
      echo 'CRITICAL: rollback flags NOT VERIFIED; check Cloudflare immediately.' >&2
      code=1
    fi
  fi
  unset secret
  exit "$code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
node --input-type=module - "$config" <<'NODE'
import fs from 'node:fs';
const cfg=JSON.parse(fs.readFileSync('wrangler.d1-pilot.jsonc','utf8'));
if(cfg.name!=='edgeforce-d1-pilot'||cfg.main!=='worker/d1-standalone.ts'||cfg.d1_databases?.length!==1||
cfg.d1_databases[0].database_id!=='a0a52a55-0e2e-42c5-b9c0-a2bc906bb32a'||
cfg.vars?.INTELLIGENCE_D1_WRITE_ENABLED!=='false'||cfg.vars?.SPORTS_SCORE_COLLECT_ENABLED!=='false'||
cfg.vars?.SPORTS_D1_WRITE_ENABLED!=='false')throw Error('Isolated pilot preflight failed');
cfg.vars.INTELLIGENCE_D1_WRITE_ENABLED='true';
cfg.vars.SPORTS_SCORE_COLLECT_ENABLED='true';
fs.writeFileSync(process.argv[2],JSON.stringify(cfg,null,2),{mode:0o600});
NODE
echo 'ACTIVATING ONLY isolated pilot scoreboard collection and D1 writes.'
restore_needed=1
npx wrangler deploy --config "$config" --keep-vars
echo "Collecting and verifying single bounded $sport scoreboard batch..."
EDGEFORCE_PILOT_URL="https://edgeforce-d1-pilot.tmbstartkleen.workers.dev" \
EDGEFORCE_PILOT_CRON_SECRET="$secret" EDGEFORCE_CERT_SPORT="$sport" \
 node scripts/certify-isolated-scores.mjs
echo 'Certification complete; rollback will now run automatically.'
