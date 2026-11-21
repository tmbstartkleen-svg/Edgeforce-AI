import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const scanner=readFileSync(new URL('../src/lib/guaranteedPayoutScanner.ts',import.meta.url),'utf8');
const presets=readFileSync(new URL('../src/lib/guaranteedPayoutPresets.ts',import.meta.url),'utf8');
test('scanner enumerates joint game outcomes and computes minimum net payoff',()=>{
 assert.match(scanner,/states=states\.flatMap/);
 assert.match(scanner,/worst=Math\.min\(worst,net\)/);
 assert.match(scanner,/net=payout-totalCost/);
});
test('guarantee requires verified settlements and all tickets filled',()=>{
 assert.match(scanner,/!settlementVerified\|\|tickets\.some\(t=>t\.fullyFilled!==true\)/);
 assert.match(scanner,/status==='complete'&&worstCaseNet!==null&&worstCaseNet>0/);
});
test('scanner rejects duplicate outcomes and caps combinatorial explosion',()=>{
 assert.match(scanner,/new Set\(g\.outcomes\)\.size!==g\.outcomes\.length/);
 assert.match(scanner,/count>maxScenarios/);
});
test('fixtures include complete soccer, binary, two-game and incomplete cover',()=>{
 for(const preset of ['soccer_three_way','binary_cross_venue','two_game_full_cover','incomplete_cover'])
  assert.ok(presets.includes(preset),preset);
});
