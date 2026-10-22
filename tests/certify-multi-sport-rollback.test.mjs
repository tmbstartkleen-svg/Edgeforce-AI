import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync('scripts/certify-multi-sport-with-rollback.sh','utf8');
test('multi-sport pilot certification enforces bounded batches and rollback',()=>{
 for(const token of ['EDGEFORCE_ISOLATED_INGEST_APPROVED','edgeforce-d1-pilot','a0a52a55-0e2e-42c5-b9c0-a2bc906bb32a','trap cleanup EXIT','restore_needed=1','ROLLBACK VERIFIED','certify-isolated-scores.mjs','CERTIFICATION SUMMARY','EDGEFORCE_CERT_SPORTS','SPORTS_D1_WRITE_ENABLED']) assert.ok(s.includes(token),token);
 assert.match(s,/sports=\(nhl nba nfl soccer-epl\)/);
 assert.match(s,/\#sports\[@\]\}" -le 6/);
 assert.match(s,/\[\[ "\$success" -gt 0 && "\$failed" -eq 0 \]\]/);
});
