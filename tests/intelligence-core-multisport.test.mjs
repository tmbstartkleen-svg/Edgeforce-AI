import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../src/lib/intelligence-core/multisport-adapter.ts',import.meta.url),'utf8');
test('multisport adapter requires sourced event timestamps and identities',()=>{
 assert.match(code,/if\(!eventId\|\|!time\)continue/);
 assert.match(code,/player-stat'&&!playerId/);
 assert.match(code,/prediction-market'&&!contractId/);
});
test('no automatic backfill or provider calls, opt-in only',()=>{
 assert.match(code,/INTELLIGENCE_MULTISPORT_MIRROR/);
 assert.match(code,/slice\(0,100\)/);
 assert.doesNotMatch(code,/fetch\(/);
});
