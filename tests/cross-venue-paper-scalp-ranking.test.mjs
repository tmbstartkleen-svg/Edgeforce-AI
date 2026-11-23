import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/lib/crossVenuePaperScalpRanking.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {rankSingleMarketScalps}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const settings=()=>({maxSpread:.1,minimumNetPerContract:.01,buyFeePerContract:.005,sellFeePerContract:.005,maxContracts:10,tickSize:.01});
const book=(venue,bid,ask)=>({venue,marketId:'m1',outcomeId:'yes',status:'verified_read_only',bestBid:bid,bestAsk:ask,bidDepth:5,askDepth:8});
test('ranks theoretical single-market spreads after fees and depth caps',()=>{
 const results=rankSingleMarketScalps([book('kalshi',.4,.45),book('polymarket_us',.4,.43)],settings());
 assert.equal(results[0].venue,'kalshi');assert.equal(results[0].status,'indicative_spread');
 assert.equal(results[0].availableContracts,5);
 assert.ok(Math.abs(results[0].estimatedNetPerContract-.04)<1e-10);
});
test('unverified books and negative net spreads cannot be paper candidates',()=>{
 const unverified={...book('kalshi',.4,.45),status:'blocked'};
 assert.equal(rankSingleMarketScalps([unverified],settings())[0].status,'blocked');
 assert.equal(rankSingleMarketScalps([book('kalshi',.4,.41)],{...settings(),buyFeePerContract:.03})[0].status,'blocked');
});
test('invalid risk settings and missing depth fail closed',()=>{
 assert.equal(rankSingleMarketScalps([book('kalshi',.4,.45)],{...settings(),tickSize:0})[0].status,'blocked');
 assert.equal(rankSingleMarketScalps([{...book('kalshi',.4,.45),askDepth:0}],settings())[0].status,'blocked');
});
