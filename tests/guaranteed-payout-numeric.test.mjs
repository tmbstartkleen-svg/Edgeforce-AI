import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../src/lib/guaranteedPayoutScanner.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {scanGuaranteedPayout}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const games=[{id:'a',outcomes:['home','away']},{id:'b',outcomes:['home','away']}];
const ticket=(id,a,b,stake=20,odds=5,fees=0,fullyFilled=true)=>({
 id,venue:'paper',selections:{a,b},stake,decimalOdds:odds,fees,fullyFilled
});
const full=[
 ticket('hh','home','home'),ticket('ha','home','away'),
 ticket('ah','away','home'),ticket('aa','away','away')
];
test('four fully covered joint outcomes pay 100 with 80 cost',()=>{
 const r=scanGuaranteedPayout(games,full,true);
 assert.equal(r.scenarios,4);assert.equal(r.uncoveredScenarios,0);
 assert.equal(r.totalCost,80);assert.equal(r.worstCaseNet,20);
 assert.equal(r.bestCaseNet,20);assert.equal(r.guaranteedProfit,true);
});
test('missing joint outcome produces a worst-case loss',()=>{
 const r=scanGuaranteedPayout(games,full.slice(0,3),true);
 assert.equal(r.uncoveredScenarios,1);assert.equal(r.worstCaseNet,-60);
 assert.equal(r.guaranteedProfit,false);
});
test('per-ticket fees erase the full-cover profit',()=>{
 const r=scanGuaranteedPayout(games,full.map(t=>({...t,fees:6})),true);
 assert.equal(r.totalCost,104);assert.equal(r.worstCaseNet,-4);
 assert.equal(r.guaranteedProfit,false);
});
test('unfilled ticket and unverified settlement never certify profit',()=>{
 for(const r of [
  scanGuaranteedPayout(games,full.map((t,i)=>i===0?{...t,fullyFilled:false}:t),true),
  scanGuaranteedPayout(games,full,false)
 ]){assert.equal(r.status,'unverified');assert.equal(r.guaranteedProfit,false);assert.equal(r.worstCaseNet,null);}
});
test('scenario cap, unknown selection, duplicate outcomes and invalid odds are rejected',()=>{
 assert.equal(scanGuaranteedPayout(games,full,true,3).status,'invalid');
 assert.equal(scanGuaranteedPayout(games,[{...full[0],selections:{unknown:'home'}}],true).status,'invalid');
 assert.equal(scanGuaranteedPayout([{id:'a',outcomes:['home','home']}],full,true).status,'invalid');
 assert.equal(scanGuaranteedPayout(games,[{...full[0],decimalOdds:0}],true).status,'invalid');
});
