import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../src/lib/soccerThreeWayDipArb.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {analyzeThreeWayDip}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const quotes=(fills=[100,100,100],fee=0)=>['home','draw','away'].map((outcome,i)=>({
 outcome,venue:'kalshi',price:[.30,.20,.35][i],feePerContract:fee,filledContracts:fills[i]
}));
test('complete three-way set has 15 dollar profit on 100 contracts each',()=>{
 const result=analyzeThreeWayDip(quotes(),true);
 assert.equal(result.status,'complete');
 assert.equal(result.completeSets,100);
 assert.ok(Math.abs(result.cost-85)<1e-8);
 assert.ok(Math.abs(result.worstCaseProfit-15)<1e-8);
 assert.equal(result.guaranteedProfit,true);
});
test('fees can erase apparent arbitrage',()=>{
 const result=analyzeThreeWayDip(quotes([100,100,100],.06),true);
 assert.ok(result.worstCaseProfit<0);
 assert.equal(result.guaranteedProfit,false);
});
test('unequal fills expose directional losses',()=>{
 const result=analyzeThreeWayDip(quotes([100,100,0]),true);
 assert.equal(result.status,'partial_exposure');
 assert.equal(result.completeSets,0);
 assert.ok(result.profitByOutcome.away<0);
 assert.equal(result.guaranteedProfit,false);
});
test('unverified settlement and malformed input are rejected',()=>{
 assert.equal(analyzeThreeWayDip(quotes(),false).status,'invalid');
 assert.equal(analyzeThreeWayDip(quotes([100,-1,100]),true).status,'invalid');
 assert.equal(analyzeThreeWayDip(quotes([100,100,100],-1),true).status,'invalid');
});
test('zero fills are not profitable positions',()=>{
 const result=analyzeThreeWayDip(quotes([0,0,0]),true);
 assert.equal(result.guaranteedProfit,false);
 assert.equal(result.worstCaseProfit,0);
});
