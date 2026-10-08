import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/lib/resultProvider.ts',import.meta.url),'utf8');

test('V167 settlement fails only if native results and fallback are both unavailable',()=>{
 assert.match(source,/if\(!provider\.ok&&!fallback\.available\)/);
 assert.doesNotMatch(source,/if\(!provider\.ok&&!normalized\.length\)/);
});

test('V167 reports empty operational settlement as an explicit no-op',()=>{
 assert.match(source,/fallbackAvailable:fallback\.available/);
 assert.match(source,/settlementNoop:normalized\.length===0/);
 assert.match(source,/mode:provider\.ok\?'live\+score-fallback':'score-fallback'/);
});
