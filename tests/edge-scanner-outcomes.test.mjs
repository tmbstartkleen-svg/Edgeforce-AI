import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/lib/edgeScanner.ts',import.meta.url),'utf8');

test('edge scanner rejects one-sided player props as arbitrage outcome sets',()=>{
 assert.match(source,/A one-sided price such as "Anytime TD \+2200" is NOT an arb leg by itself/);
 assert.match(source,/if\(!scanEligible\|\|!outcomeKey\)continue/);
 assert.match(source,/function completeOutcomeSet\(rows:GroupedQuote\[\]\)/);
 assert.match(source,/expectedOutcomeKeys/);
});

test('edge scanner only allows validated complementary outcome families',()=>{
 assert.match(source,/OVER_UNDER/);
 assert.match(source,/YES_NO/);
 assert.match(source,/MONEYLINE_2WAY/);
 assert.match(source,/MONEYLINE_3WAY/);
 assert.match(source,/SPREAD_2WAY/);
 assert.match(source,/if\(!outcomes\)continue/);
});
