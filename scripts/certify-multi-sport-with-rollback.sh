#!/usr/bin/env bash
# Authorized bounded multi-sport REAL scoreboard certification, isolated pilot ONLY.
# Run in the Edgeforce-AI repo with Wrangler OAuth logged in.
set -euo pipefail
cd "$(dirname "$0")/.."
[[ "${EDGEFORCE_ISOLATED_INGEST_APPROVED:-}" == "yes" ]] || { echo 'Explicit staging authorization required' >&2; exit 1; }
unset CLOUDFLARE_API_TOKEN
[[ -f wrangler.d1-pilot.jsonc ]] || exit 1
secret=$(security find-generic-password -a "$USER" -s edgeforce-d1-pilot-cron -w)
[[ "${#secret}" -ge 24 ]] || { echo 'Pilot secret unavailable' >&2; exit 1; }
sports=(nhl nba nfl soccer-epl)
if [[ -n "${EDGEFORCE_CERT_SPORTS:-}" ]]; then
  IFS=',' read -r -a sports <<< "$EDGEFORCE_CERT_SPORTS"
fi
[[ "${#sports[@]}" -ge 1 && "${#sports[@]}" -le 6 ]] || { echo 'Batch must have 1-6 sports' >&2; exit 1; }
declare -A seen=()
for sport in "${sports[@]}"; do
  case "$sport" in nhl|nba|nfl|soccer-epl|soccer-laliga|soccer-bundesliga|soccer-serie-a|soccer-ligue-1|soccer-mls|soccer-ucl|soccer-uel|ncaaf|ncaab|mlb|wnba|soccer-nwsl) ;; *) echo 'Unapproved sport in batch' >&2; exit 1 ;; esac
  [[ -z "${seen[$sport]:-}" ]] || { echo 'Repeated sport in batch' >&2; exit 1; }
  seen["$sport"]=1
done
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
success=0
failed=0
for sport in "${sports[@]}"; do
 echo "Certifying bounded scoreboard batch for $sport..."
 if EDGEFORCE_PILOT_URL="https://edgeforce-d1-pilot.tmbstartkleen.workers.dev" \
    EDGEFORCE_PILOT_CRON_SECRET="$secret" EDGEFORCE_CERT_SPORT="$sport" \
    node scripts/certify-isolated-scores.mjs; then
   success=$((success+1))
 else
   failed=$((failed+1))
   echo "Source $sport not certified; no coverage claim for this source."
 fi
done
echo "CERTIFICATION SUMMARY: passed=$success failed=$failed requested=${#sports[@]}"
[[ "$success" -gt 0 && "$failed" -eq 0 ]] || exit 1
echo 'Certification complete; rollback will now run automatically.'
