import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const s=readFileSync('worker/d1-score-coverage.ts','utf8');
test('score evidence does not imply sportsbook odds or licensing',()=>{
 assert.match(s,/observation_kind='score'/);
 assert.match(s,/s\.enabled=1/);
 assert.match(s,/s\.upstream_id=o\.upstream_id/);
 assert.match(s,/independentSportsbookOddsCertified:false/);
 assert.match(s,/sourceUsageRightsCertified:false/);
 assert.match(s,/automatedCollectionCertified:false/);
 assert.match(s,/UNAUTHORIZED/);
});
