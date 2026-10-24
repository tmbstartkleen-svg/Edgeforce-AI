import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const w=readFileSync(new URL('../.github/workflows/deploy-d1-native-dashboard.yml',import.meta.url),'utf8');
test('D1-native deploy is owner-dispatched with exact commit and no automatic push trigger',()=>{
 assert.match(w,/workflow_dispatch:/);assert.doesNotMatch(w,/\n  push:/);
 assert.match(w,/expected_main_sha:/);assert.match(w,/test "\$EXPECTED_SHA" = "\$GITHUB_SHA"/);
 assert.match(w,/acknowledge_no_paid_odds/);
});
test('requires both exact-main workflows before deploying',()=>{
 assert.match(w,/Verify Edgeforce"/);assert.match(w,/Verify Edgeforce Cloudflare"/);
 assert.match(w,/\.head_sha==env.EXPECTED_SHA/);
 assert.match(w,/test "\$\(git rev-parse FETCH_HEAD\)" = "\$EXPECTED_SHA"/);
});
test('uses Cloudflare D1 schema read-only and no Neon or Postgres dependencies',()=>{
 assert.match(w,/wrangler d1 execute edgeforce-intelligence --remote/);
 assert.match(w,/sqlite_master/);assert.doesNotMatch(w,/npm run migrate|production-db-preflight|NEON_DATABASE_URL|POSTGRES_URL/);
 assert.match(w,/D1_SPORTS_MARKET_ARCHIVE_ENABLED/);assert.match(w,/ALLOW_DEMO_DATA/);
 assert.match(w,/ATLAS_SCHEDULE_EXECUTION_ENABLED/);
});
test('deploys existing secret-bearing Worker without rotating tokens and tests protected dashboard',()=>{
 assert.match(w,/wrangler deploy --config dist\/server\/wrangler.json/);
 assert.doesNotMatch(w,/wrangler secret put|secrets-file|openssl rand/);
 assert.match(w,/remote-dashboard/);assert.match(w,/\.error=="UNAUTHORIZED"/);
});
