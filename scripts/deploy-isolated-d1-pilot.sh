#!/usr/bin/env bash
# Deploy ONLY the isolated D1 pilot from a locally checked-out, reviewed commit.
# Preserves existing secret bindings; deliberately never enables collection.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "${EDGEFORCE_ISOLATED_PILOT_DEPLOY_APPROVED:-}" != "yes" ]]; then
  echo "STOP: explicitly set EDGEFORCE_ISOLATED_PILOT_DEPLOY_APPROVED=yes" >&2
  exit 1
fi
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" || -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "STOP: Cloudflare scoped deployment credentials required in shell environment" >&2
  exit 1
fi
node --input-type=module <<'NODE'
import fs from 'node:fs';
const c=JSON.parse(fs.readFileSync('wrangler.d1-pilot.jsonc','utf8'));
if(c.name!=='edgeforce-d1-pilot'||c.main!=='worker/d1-standalone.ts'||
 c.d1_databases?.length!==1||c.d1_databases[0].database_id!=='a0a52a55-0e2e-42c5-b9c0-a2bc906bb32a'||
 c.vars?.SPORTS_SCORE_COLLECT_ENABLED!=='false'||c.vars?.INTELLIGENCE_D1_WRITE_ENABLED!=='false'||
 c.vars?.SPORTS_D1_WRITE_ENABLED!=='false')
 throw Error('STOP: isolated pilot target or disabled permissions changed');
console.log('Validated isolated pilot binding and all collection/write switches disabled.');
NODE
npx wrangler deploy --config wrangler.d1-pilot.jsonc --keep-vars
echo "Deployment command finished. Verify remote settings, auth-gated readiness and D1 binding before certifying."
echo "No score collection or D1 writes were authorized by this script."
