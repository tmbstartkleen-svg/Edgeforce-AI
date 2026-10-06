import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/lib/providers/http.ts',import.meta.url),'utf8');

test('Odds API exhausted quota uses monthly reset cooldown',()=>{
 assert.match(source,/Date\.UTC\(now\.getUTCFullYear\(\),now\.getUTCMonth\(\)\+1,1,0,5,0\)/);
 assert.match(source,/quota has been reached\|OUT_OF_USAGE_CREDITS/);
});

test('429 cooldown remains distinct from monthly quota cooldown',()=>{
 assert.match(source,/attempts\.some\(x=>x\.status===429\)\?300000/);
});
