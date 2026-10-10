import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/lib/edgeScanner.ts',import.meta.url),'utf8');

test('edge scanner only accepts player props with explicit over-under sides and exact lines',()=>{
 assert.match(source,/PLAYER_OU/);
 assert.match(source,/const side=/\\bover\\b\/i\.test\(selection\)\?'over':/\\bunder\\b\/i\.test\(selection\)\?'under':''/);
 assert.match(source,/family=\[player,stat,String\(Math\.abs\(line\)\)\]\.join\('\|'\)/);
 assert.match(source,/Over\/Under player props are scanned only when event, player identity, stat key, and exact line match/);
});

test('edge scanner excludes one-sided player props such as anytime TD',()=>{
 assert.match(source,/if\(side&&line!==undefined&&player\)return 'PLAYER_OU'/);
 assert.match(source,/return null;/);
 assert.match(source,/one-sided props such as anytime TD remain excluded/);
});

test('edge scanner requires complete supported outcome sets',()=>{
 assert.match(source,/MONEYLINE_2WAY/);
 assert.match(source,/MONEYLINE_3WAY/);
 assert.match(source,/TOTAL_2WAY/);
 assert.match(source,/SPREAD_2WAY/);
 assert.match(source,/PLAYER_OU/);
 assert.match(source,/function completeGroup\(rows:Quote\[\]\)/);
 assert.match(source,/if\(!expected\)continue/);
});

test('edge scanner rejects implausible arb and EV outputs',()=>{
 assert.match(source,/EDGE_SCANNER_MAX_ARB_ROI/);
 assert.match(source,/rejectedSuspiciousArbitrage\+\+/);
 assert.match(source,/EDGE_SCANNER_MAX_EV/);
 assert.match(source,/rejectedSuspiciousEv\+\+/);
});
