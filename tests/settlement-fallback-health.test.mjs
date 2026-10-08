import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/lib/resultProvider.ts',import.meta.url),'utf8');

test('settlement only fails when both native provider and fallback are unavailable',()=>{
 assert.match(source,/if\(!provider\.ok&&!fallback\.available\)/);
 assert.doesNotMatch(source,/if\(!provider\.ok&&!normalized\.length\)/);
});

test('healthy empty settlement runs are surfaced as no-ops',()=>{
 assert.match(source,/fallbackAvailable:fallback\.available/);
 assert.match(source,/settlementNoop:normalized\.length===0/);
 assert.match(source,/mode:provider\.ok\?'live\+score-fallback':'score-fallback'/);
});
