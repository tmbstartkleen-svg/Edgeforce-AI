import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const c=readFileSync('scripts/certify-isolated-scores.mjs','utf8');
test('score certification is explicitly restricted to isolated pilot and does not manage Worker settings',()=>{
 assert.match(c,/edgeforce-d1-pilot/);
 assert.match(c,/ISOLATED_PILOT_URL_REQUIRED/);
 assert.match(c,/OWNER_PILOT_SECRET_REQUIRED/);
 assert.match(c,/STAGING_FLAGS_DISABLED/);
 assert.doesNotMatch(c,/wrangler secret put|deploy --|cloudflare\.request|UPDATE intelligence_sources|INSERT INTO/);
});
test('staging certification requires real upstream, accepted storage and matching readback',()=>{
 for(const x of ['score-collector-readiness','probe-score-source','collect-scores','/api/operations/d1-pilot/recent','PERSISTENCE_NOT_VERIFIED','NO_SOURCE_MATCHING_D1_READBACK','SCORES_NOT_ODDS'])assert.ok(c.includes(x),x);
 assert.match(c,/oddsCertified:false/);
});
