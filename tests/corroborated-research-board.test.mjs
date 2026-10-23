import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=p=>ts.transpileModule(fs.readFileSync(new URL('../src/lib/'+p,import.meta.url),'utf8'),
 {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const agreement=uri(compile('independent-quote-agreement.ts'));
const engine=uri(compile('verified-value-engine.ts'));
const src=compile('corroborated-research-board.ts')
 .replace("from './independent-quote-agreement'","from "+JSON.stringify(agreement))
 .replace("from './verified-value-engine'","from "+JSON.stringify(engine));
const {buildCorroboratedResearchBoard}=await import(uri(src));
const now=Date.parse('2026-10-23T20:00:00Z');
const quote=(upstreamId,americanOdds=-117,extra={})=>({
 upstreamId,bookmaker:'DraftKings',eventId:'event-1',marketType:'h2h',outcomeId:'home',
 americanOdds,observedAt:new Date(now-30000).toISOString(),
 startsAt:new Date(now+3600000).toISOString(),...extra});
const input=(id,p=.6)=>({id,sport:'basketball',league:'NBA',eventName:'Home vs Away',
 primary:quote('feed-one'),competitors:[quote('feed-two',-118)],
 forecast:{probability:p,modelId:'model-test',modelVersion:'1',calibrated:true,
 independentlyDerived:true,asOf:new Date(now-20000).toISOString(),
 sampleSize:200,calibrationMeanAbsoluteError:.03}});
test('real two-source same-market arithmetic is ranked only as research',()=>{
 const r=buildCorroboratedResearchBoard([input('a',.6),input('b',.7)],now);
 assert.equal(r.qualifiedForResearch,2);
 assert.deepEqual(r.rows.map(x=>x.id),['b','a']);
 assert.equal(r.rows[0].status,'RESEARCH_ONLY');
 assert.equal(r.verifiedBetCount,0);
 assert.equal(r.releaseCertified,false);
 assert.ok(r.rows[0].edgePercentagePoints>0);
});
test('same upstream repeated, book mismatch and divergent prices block results',()=>{
 const same=input('s');same.competitors=[quote('feed-one')];
 const different=input('d');different.competitors=[quote('feed-two',-118,{bookmaker:'FanDuel'})];
 const divergent=input('x');divergent.competitors=[quote('feed-two',+180)];
 const r=buildCorroboratedResearchBoard([same,different,divergent],now);
 assert.equal(r.qualifiedForResearch,0);
 assert.equal(r.blockedReasons.NO_COMPARABLE_INDEPENDENT_PRICE,3);
});
test('expired source prices and unsigned model-like claims cannot qualify',()=>{
 const stale=input('stale');stale.competitors=[quote('feed-two',-118,{observedAt:new Date(now-3600000).toISOString()})];
 const uncalibrated=input('uncalibrated');uncalibrated.forecast.calibrated=false;
 const r=buildCorroboratedResearchBoard([stale,uncalibrated],now);
 assert.equal(r.qualifiedForResearch,0);
 assert.equal(r.blockedReasons.NO_COMPARABLE_INDEPENDENT_PRICE,1);
 assert.equal(r.blockedReasons.MODEL_EVIDENCE_NOT_SUPPORTED,1);
});
test('does not call networks, write D1, or declare executable picks',()=>{
 assert.doesNotMatch(src,/fetch\(|INSERT INTO|Math\.random/);
 assert.throws(()=>buildCorroboratedResearchBoard([],now,101),/INVALID_RESEARCH_BOARD_INPUT/);
});

test('expired primary quote cannot borrow agreement from fresher competitors',()=>{
 const primaryStale=input('stale-primary');
 primaryStale.primary.observedAt=new Date(now-3600000).toISOString();
 primaryStale.competitors=[quote('feed-two'),quote('feed-three',-118)];
 const r=buildCorroboratedResearchBoard([primaryStale],now);
 assert.equal(r.qualifiedForResearch,0);
 assert.equal(r.blockedReasons.PRIMARY_QUOTE_INVALID_OR_STALE,1);
});
