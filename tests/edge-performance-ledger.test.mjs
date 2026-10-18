import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const opts={compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}};
const edge=ts.transpileModule(fs.readFileSync(new URL('../src/lib/edgeValue.ts',import.meta.url),'utf8'),opts).outputText;
const edgeUrl='data:text/javascript;base64,'+Buffer.from(edge).toString('base64');
const ledger=ts.transpileModule(fs.readFileSync(new URL('../src/lib/edgePerformanceLedger.ts',import.meta.url),'utf8'),opts).outputText.replace(/from ['"]\.\/edgeValue['"]/g,'from '+JSON.stringify(edgeUrl));
const {summarizeEdgePerformance}=await import('data:text/javascript;base64,'+Buffer.from(ledger).toString('base64'));
const make=(result,extra={})=>({id:'a',sport:'NCAAF',marketKey:'total-44.5',modelId:'research-v1',predictionCreatedAt:'2026-10-10T20:00:00Z',eventStartedAt:'2026-10-11T00:00:00Z',quotedOdds:-117,predictedProbability:.571,result,settledAt:'2026-10-11T04:00:00Z',settlementVerified:true,closingQuoteVerified:false,...extra});
test('verified win and loss show realized outcomes separate from forecast',()=>{
 const s=summarizeEdgePerformance([make('WIN'),make('LOSS',{id:'b'})]);
 assert.equal(s.eligibleCount,2);assert.equal(s.wins,1);assert.equal(s.losses,1);assert.equal(s.winRate,.5);
 assert.ok(Math.abs(s.projectedRoiPercent-5.9)<.01);
 assert.ok(s.realizedRoiPercent<0);
 assert.equal(s.sampleSufficient,false);
});
test('unverified and post-start predictions never enter calibration',()=>{
 const s=summarizeEdgePerformance([make('WIN',{settlementVerified:false}),make('WIN',{predictionCreatedAt:'2026-10-11T01:00:00Z'})]);
 assert.equal(s.eligibleCount,0);assert.equal(s.excludedCount,2);
 assert.equal(s.realizedRoiPercent,null);
});
test('unverified closing odds do not count toward CLV',()=>{
 const s=summarizeEdgePerformance([make('WIN',{closingOdds:-125})]);
 assert.equal(s.meanClosingLineValuePp,null);
 assert.equal(s.closingLineSampleCount,0);
});
