import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/firstPartyMarketMath.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {twoWayFairPrice,evaluateTwoWayArbitrage,executableExchangeYesCost}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const now='2026-10-22T15:00:00.000Z';
const a={side:'A',americanOdds:120,maxStake:100,source:'book-one',observedAt:now,rulesKey:'game-1-2way-final'};
const b={...a,side:'B',americanOdds:120,source:'book-two'};
test('two-way devig is normalized and accounts for overround',()=>{
 const r=twoWayFairPrice(-110,-110);
 assert.ok(Math.abs(r.fairA-.5)<1e-12);
 assert.ok(r.overround>0);
 assert.equal(r.method,'PROPORTIONAL_DEVIG_ESTIMATE');
});
test('arbitrage sizing bounded by available liquidity',()=>{
 const r=evaluateTwoWayArbitrage([a,b],now);
 assert.equal(r.status,'GROSS_ARBITRAGE');
 assert.ok(Math.abs(r.grossRoi-.1)<1e-10);
 assert.ok(r.stakeA<=100&&r.stakeB<=100);
 assert.equal(r.netRoi,null);
});
test('different rules, missing side and stale prices never qualify',()=>{
 for(const legs of [[a,{...b,rulesKey:'different'}],[a,{...b,side:'A'}],[a,{...b,observedAt:'2026-10-22T13:00:00Z'}]])
  assert.equal(evaluateTwoWayArbitrage(legs,now).status,'RESEARCH_ONLY');
});
test('exchange order uses executable ask depth, not last trade',()=>{
 const r=executableExchangeYesCost([{price:.55,contracts:2},{price:.52,contracts:1}],3,.01);
 assert.equal(r.executable,true);
 assert.ok(Math.abs(r.cost-1.65)<1e-9);
 assert.equal(executableExchangeYesCost([{price:.55,contracts:1}],3).executable,false);
});
