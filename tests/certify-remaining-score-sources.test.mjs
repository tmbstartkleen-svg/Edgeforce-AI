import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync('scripts/certify-remaining-score-sources-with-rollback.sh','utf8');
test('12 unproven sources split into isolated <=6 cohorts',()=>{
 const names=['ncaaf','ncaab','wnba','mlb','soccer-laliga','soccer-bundesliga','soccer-serie-a','soccer-ligue-1','soccer-mls','soccer-nwsl','soccer-ucl','soccer-uel'];
 for(const n of names)assert.ok(s.includes(n),n);
 for(const group of [...s.matchAll(/'([^']+(?:,[^']+){5})'/g)].map(x=>x[1]).filter(x=>x.startsWith('ncaaf')||x.startsWith('soccer-serie-a')))assert.equal(group.split(',').length,6);
 assert.doesNotMatch(s,/declare\s+-A\b/);
});
test('each cohort reuses certified script and fail-closes on unsafe recovery',()=>{
 assert.match(s,/certify-multi-sport-with-rollback\.sh/);
 assert.match(s,/EDGEFORCE_ISOLATED_INGEST_APPROVED/);
 assert.match(s,/collectionEnabled!==false/);
 assert.match(s,/d1WriteEnabled!==false/);
 assert.match(s,/halting remaining cohorts/);
 assert.match(s,/individual results are authoritative/);
});
