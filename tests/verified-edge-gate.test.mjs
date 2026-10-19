import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const edge=fs.readFileSync('src/lib/edgeValue.ts','utf8');
const gate=fs.readFileSync('src/lib/verifiedEdgeGate.ts','utf8').replace("import {calculateEdgeValue} from './edgeValue';",'');
const js=ts.transpileModule(edge+'\n'+gate,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {evaluateVerifiedEdge}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const now=Date.parse('2026-10-19T20:00:00Z');
const base={americanOdds:-117,modelProbability:0.571,eventId:'e',marketId:'ml',sportsbook:'DK',oddsUpstreamId:'provider-a',oddsObservedAt:'2026-10-19T19:59:00Z',modelId:'m',modelValidated:true,independentOddsSources:2};
test('math reports New Mexico probability edge while refusing unauthenticated approval',()=>{
 const r=evaluateVerifiedEdge(base,now);
 assert.ok(Math.abs(r.probabilityEdgePp-3.1829493)<0.0001);
 assert.ok(Math.abs(r.expectedRoiPercent-5.9034188)<0.001);
 assert.equal(r.evidenceReady,true);
 assert.equal(r.productionBetRecommendationAuthorized,false);
});
test('stale prices and unvalidated models block evidence readiness',()=>{
 const r=evaluateVerifiedEdge({...base,modelValidated:false,independentOddsSources:1,oddsObservedAt:'2026-10-19T18:00:00Z'},now);
 assert.deepEqual(r.blockers,['STALE_OR_INVALID_ODDS','MODEL_NOT_VALIDATED','INSUFFICIENT_INDEPENDENT_ODDS_SOURCES']);
});
test('high winning probability is insufficient for betting value',()=>{
 const r=evaluateVerifiedEdge({...base,americanOdds:-2500,modelProbability:0.95},now);
 assert.ok(r.blockers.includes('NO_POSITIVE_EDGE'));
});
