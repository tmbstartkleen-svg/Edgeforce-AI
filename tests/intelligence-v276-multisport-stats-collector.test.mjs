import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/lib/playerWarehouse.ts',import.meta.url),'utf8');
const adapter=readFileSync(new URL('../src/lib/intelligence-core/multisport-adapter.ts',import.meta.url),'utf8');
test('existing stats collector has opt-in source-dated warehouse mirror',()=>{
 assert.match(source,/INTELLIGENCE_MULTISPORT_MIRROR==='true'/);
 assert.match(source,/mirrorCollectorPayload\('player-stat',result\.data,result\.providerId/);
 assert.match(source,/degraded:Boolean\(result\.degraded\)/);
 assert.match(source,/ingestPlayerHistoryPayload\(result\.data/);
});
test('does not invent player stat or prediction market observations',()=>{
 assert.match(adapter,/kind==='player-stat'&&!playerId/);
 assert.match(adapter,/kind==='prediction-market'&&!contractId/);
 assert.match(adapter,/if\(!eventId\|\|!time\)continue/);
 assert.match(adapter,/INTELLIGENCE_MULTISPORT_MIRROR/);
});
