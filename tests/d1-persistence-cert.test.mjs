import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync('worker/d1-persistence-cert.ts','utf8');
test('D1 certification uses distinguishable disabled synthetic source',()=>{
 assert.match(src,/CERTIFICATION_ONLY/);
 assert.match(src,/enabled\)\s*VALUES \(\?,\?,\?,0\)/);
 assert.match(src,/noSportsClaim:true/);
 assert.match(src,/sportsObservationsVerified:false/);
 assert.match(src,/UNAUTHORIZED/);
 assert.match(src,/INSERT OR IGNORE INTO intelligence_observations/);
 assert.match(src,/SELECT source_id,upstream_id,event_id,payload_hash/);
});
