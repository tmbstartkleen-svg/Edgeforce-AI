import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/lib/edgeScanner.ts',import.meta.url),'utf8');

test('edge scanner excludes player props until separately certified',()=>{
 assert.match(source,/raw\.startsWith\('player'\)\|\|m\.playerContext\?\.name/);
 assert.match(source,/playerProps:'temporarily excluded/);
});

test('edge scanner requires complete supported outcome sets',()=>{
 assert.match(source,/MONEYLINE_2WAY/);
 assert.match(source,/MONEYLINE_3WAY/);
 assert.match(source,/TOTAL_2WAY/);
 assert.match(source,/SPREAD_2WAY/);
 assert.match(source,/function completeGroup\(rows:Quote\[\]\)/);
 assert.match(source,/if\(!expected\)continue/);
});

test('edge scanner rejects implausible arb and EV outputs',()=>{
 assert.match(source,/EDGE_SCANNER_MAX_ARB_ROI/);
 assert.match(source,/rejectedSuspiciousArbitrage\+\+/);
 assert.match(source,/EDGE_SCANNER_MAX_EV/);
 assert.match(source,/rejectedSuspiciousEv\+\+/);
});
