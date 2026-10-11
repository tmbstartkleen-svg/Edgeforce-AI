import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const mesh=readFileSync(new URL('../src/lib/liveScoreMesh.ts',import.meta.url),'utf8');
const route=readFileSync(new URL('../src/app/api/live-scores/route.ts',import.meta.url),'utf8');
test('local fetch timestamp is not treated as vendor observation timestamp',()=>{
 assert.match(mesh,/sourceObservedAt\?:string/);
 assert.match(route,/if\(!game\.sourceObservedAt\|\|!game\.id\|\|!game\.source\)continue/);
 assert.match(route,/observedAt:game\.sourceObservedAt/);
 assert.doesNotMatch(route,/observedAt:game\.observedAt/);
});
test('score mirror is opt-in, capped and uses the existing fetch',()=>{
 assert.match(route,/INTELLIGENCE_LIVE_SCORE_MIRROR==='true'/);
 assert.match(route,/games\.slice\(0,100\)/);
 assert.match(route,/Array\.from\(groups\)\.slice\(0,3\)/);
 assert.match(route,/mirrorCollectorPayload\('score'/);
 assert.equal((route.match(/fetchLiveScoreMesh\(/g)||[]).length,1);
});
