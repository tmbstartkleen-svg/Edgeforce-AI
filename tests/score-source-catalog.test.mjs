import test from 'node:test';import assert from 'node:assert/strict';
import {scoreSports,scoreboardSource} from '../src/lib/intelligence-core/score-source-catalog.mjs';
test('approved score catalog is bounded and never claims odds coverage',()=>{
 assert.equal(scoreSports.length,8);
 for(const source of scoreSports){
  const result=scoreboardSource(source.id);
  assert.match(result.endpoint,/^https:\/\/site\.api\.espn\.com\/apis\/site\/v2\/sports\//);
  assert.equal(result.classification,'SCORES_NOT_ODDS');
  assert.equal(result.upstreamId,'site.api.espn.com');
 }
 assert.throws(()=>scoreboardSource('../../other'),/SPORT_NOT_APPROVED/);
});
