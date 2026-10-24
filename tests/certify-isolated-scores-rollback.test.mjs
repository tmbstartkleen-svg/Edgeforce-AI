import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const c=readFileSync('scripts/certify-isolated-scores-with-rollback.sh','utf8');
test('one shot isolation, explicit consent, bounded sports and rollback on any exit',()=>{
 for(const v of ['EDGEFORCE_ISOLATED_INGEST_APPROVED','edgeforce-d1-pilot','a0a52a55-0e2e-42c5-b9c0-a2bc906bb32a','trap cleanup EXIT','restore_needed=1','--keep-vars','ROLLBACK VERIFIED','certify-isolated-scores.mjs'])assert.ok(c.includes(v),v);
 assert.match(c,/sport" == "nhl" \|\| "\$sport" == "nba"/);
 assert.match(c,/SPORTS_D1_WRITE_ENABLED.*'false'/);
 assert.match(c,/CLOUDFLARE_API_TOKEN/);
 assert.doesNotMatch(c,/edgeforce-intelligence[^-]/);
});
