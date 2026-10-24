#!/usr/bin/env bash
# Isolated pilot ONLY. Three bounded cohorts (6 each), each with its own rollback.
# This can produce partial evidence. Empty feeds are NOT successful certification.
set -euo pipefail
cd "$(dirname "$0")/.."
[[ "${EDGEFORCE_ISOLATED_INGEST_APPROVED:-}" == yes ]] || { echo 'Explicit isolated pilot authorization required' >&2; exit 1; }
[[ -z "${CLOUDFLARE_API_TOKEN:-}" ]] || { echo 'Unset CLOUDFLARE_API_TOKEN; use Wrangler OAuth for this test' >&2; exit 1; }
cohorts=(
 'ncaaf,ncaab,wnba,mlb,soccer-laliga,soccer-bundesliga'
 'soccer-serie-a,soccer-ligue-1,soccer-mls,soccer-nwsl,soccer-ucl,soccer-uel'
)
passed_cohorts=0
failed_cohorts=0
for cohort in "${cohorts[@]}"; do
  echo "ISOLATED SIX-SOURCE COHORT: $cohort"
  if EDGEFORCE_CERT_SPORTS="$cohort" bash scripts/certify-multi-sport-with-rollback.sh; then
    passed_cohorts=$((passed_cohorts+1))
  else
    failed_cohorts=$((failed_cohorts+1))
    echo 'COHORT NOT FULLY CERTIFIED: inspect individual source results; rollback must be verified.'
    # Never proceed when the pilot might still be write-enabled.
    EDGEFORCE_PILOT_CRON_SECRET="$(security find-generic-password -a "$USER" -s edgeforce-d1-pilot-cron -w)" node --input-type=module <<'NODE'
const base='https://edgeforce-d1-pilot.tmbstartkleen.workers.dev';
const res=await fetch(base+'/api/operations/d1-pilot/score-collector-readiness',{
 headers:{Authorization:'Bearer '+process.env.EDGEFORCE_PILOT_CRON_SECRET},
 signal:AbortSignal.timeout(15000)});
const data=await res.json().catch(()=>null);
if(res.status!==200||data?.ok!==true||data.flags?.collectionEnabled!==false||data.flags?.d1WriteEnabled!==false){
 console.error('CRITICAL: pilot disabled state not verified; halting remaining cohorts');
 process.exit(1);
}
console.log('COHORT SAFETY GATE VERIFIED: collection and intelligence D1 writes disabled.');
NODE
  fi
done
echo "REMAINING SOURCE COHORT SUMMARY: passed=$passed_cohorts failed=$failed_cohorts; individual results are authoritative."
[[ "$failed_cohorts" -eq 0 ]] || exit 1
