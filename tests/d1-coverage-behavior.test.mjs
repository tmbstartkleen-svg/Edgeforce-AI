import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=name=>ts.transpileModule(fs.readFileSync(new URL('../'+name,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const inv=uri(read('src/lib/coverage-inventory.ts'));
const consensus=uri(read('src/lib/independent-quote-consensus.ts'));
const compiled=read('worker/d1-coverage.ts')
 .replaceAll("from '../src/lib/coverage-inventory'","from "+JSON.stringify(inv))
 .replaceAll("from '../src/lib/independent-quote-consensus'","from "+JSON.stringify(consensus));
const {d1CoverageGateway}=await import(uri(compiled));
const secret='a'.repeat(32),now=Date.now();
const rows=[{source_id:'approved-feed',upstream_id:'real-upstream-one',event_id:'event-1',observed_at:new Date(now-5000).toISOString(),
 payload:JSON.stringify({provider:'approved-feed',kind:'odds',value:{bookmaker:'DraftKings',sport:'NBA',league:'NBA',marketType:'player_points',outcomeId:'over',startsAt:new Date(now+3600000).toISOString(),playerId:'player-123',line:'22.5',priceAmerican:-115}})}];
function env(data=rows){return {CRON_SECRET:secret,INTELLIGENCE_DB:{prepare(sql){assert.match(sql,/observation_kind='(?:odds|score)'/);return {bind(n){assert.ok(n<=250);return {all:async()=>({results:sql.includes("observation_kind='score'")?[]:data})}}}}}};}
const req=(auth=true)=>new Request('https://edgeforce.example/api/operations/d1-pilot/coverage',{headers:auth?{authorization:'Bearer '+secret}:{}});
test('D1 coverage rejects unauthenticated callers without querying',async()=>{
 const response=await d1CoverageGateway(req(false),{CRON_SECRET:secret,INTELLIGENCE_DB:{prepare(){throw Error('unauthorized query')}}});
 assert.equal(response.status,401);
});
test('D1 coverage reads real stored prop lines from normalized envelope',async()=>{
 const response=await d1CoverageGateway(req(),env());
 assert.equal(response.status,200);
 const report=await response.json();
 assert.equal(report.freshDraftKingsQuotes,1);
 assert.equal(report.discovered.players,1);
 assert.equal(report.discovered.outcomes,1);
 assert.equal(report.leagues[0].league,'NBA');
 assert.equal(report.leagues[0].players,1);
 assert.equal(report.leagues[0].marketTypes,1);
 assert.equal(report.leagues[0].quotes,1);
 assert.deepEqual(report.providers,['approved-feed']);
 assert.equal(report.independentVerification.independentUpstreams,1);
 assert.equal(report.independentVerification.crossProviderVerified,false);
});
test('D1 coverage excludes stale observations without treating them as live quotes',async()=>{
 const old=[{...rows[0],observed_at:new Date(now-3600000).toISOString()}];
 const report=await (await d1CoverageGateway(req(),env(old))).json();
 assert.equal(report.freshDraftKingsQuotes,0);
 assert.equal(report.rejected.STALE_OR_FUTURE,1);
});

test('multiple sportsbook observations from one upstream do not imply independent verification',async()=>{
 const second={...rows[0],source_id:'second-adapter',event_id:'event-2'};
 const report=await (await d1CoverageGateway(req(),env([rows[0],second]))).json();
 assert.equal(report.independentVerification.independentUpstreams,1);
 assert.equal(report.independentVerification.crossProviderVerified,false);
});

test('different upstream owners require exact quote identity before certification',async()=>{
 const different={...rows[0],source_id:'another-feed',upstream_id:'other-upstream',payload:JSON.stringify({value:{bookmaker:'DraftKings',sport:'NBA',league:'NBA',marketType:'player_points',outcomeId:'under',startsAt:new Date(now+3600000).toISOString(),playerId:'player-123',line:'22.5',priceAmerican:-115}})};
 const report=await (await d1CoverageGateway(req(),env([rows[0],different]))).json();
 assert.equal(report.independentVerification.independentUpstreams,2);
 assert.equal(report.independentVerification.crossProviderVerified,false);
 assert.equal(report.independentVerification.verifiedOutcomes,0);
});
test('matching quotes from independent upstreams can be corroborated',async()=>{
 const different={...rows[0],source_id:'another-feed',upstream_id:'other-upstream'};
 const report=await (await d1CoverageGateway(req(),env([rows[0],different]))).json();
 assert.equal(report.independentVerification.crossProviderVerified,true);
 assert.equal(report.independentVerification.verifiedOutcomes,1);
});

test('stale second upstream does not inflate fresh upstream count',async()=>{
 const stale={...rows[0],source_id:'old-feed',upstream_id:'old-upstream',observed_at:new Date(now-3600000).toISOString()};
 const report=await (await d1CoverageGateway(req(),env([rows[0],stale]))).json();
 assert.equal(report.independentVerification.independentUpstreams,1);
 assert.equal(report.independentVerification.crossProviderVerified,false);
});
test('unpriced second upstream cannot inflate verified source count',async()=>{
 const unpriced={...rows[0],source_id:'empty-feed',upstream_id:'empty-upstream',payload:JSON.stringify({value:{bookmaker:'DraftKings',sport:'NBA',league:'NBA',marketType:'player_points',outcomeId:'over',startsAt:new Date(now+3600000).toISOString(),playerId:'player-123',line:'22.5'}})};
 const report=await (await d1CoverageGateway(req(),env([rows[0],unpriced]))).json();
 assert.equal(report.independentVerification.independentUpstreams,1);
 assert.equal(report.independentVerification.crossProviderVerified,false);
});

test('non-DraftKings bookmaker quotes cannot inflate DraftKings priced coverage',async()=>{
 const other={...rows[0],source_id:'other-book-feed',upstream_id:'other-book-upstream',
  payload:JSON.stringify({value:{bookmaker:'FanDuel',sport:'NBA',league:'NBA',
   marketType:'player_points',outcomeId:'over',startsAt:new Date(now+3600000).toISOString(),
   playerId:'player-123',line:'22.5',priceAmerican:-110}})};
 const report=await (await d1CoverageGateway(req(),env([other]))).json();
 assert.equal(report.freshDraftKingsQuotes,0);
 assert.equal(report.independentVerification.crossProviderVerified,false);
});

test('two owners with different observation timestamps still verify the same priced player outcome',async()=>{
 const second={...rows[0],source_id:'independent-feed',upstream_id:'independent-owner',
  observed_at:new Date(now-9000).toISOString()};
 const report=await (await d1CoverageGateway(req(),env([rows[0],second]))).json();
 assert.equal(report.ok,true);
 assert.equal(report.discovered.outcomes,1);
 assert.equal(report.independentVerification.independentUpstreams,2);
 assert.equal(report.independentVerification.verifiedOutcomes,1);
 assert.equal(report.independentVerification.crossProviderVerified,true);
});

test('price disagreement is not reported as independently price-verified',async()=>{
 const conflicting={...rows[0],source_id:'independent-other',upstream_id:'another-owner',
  observed_at:new Date(now-9000).toISOString(),
  payload:JSON.stringify({value:{bookmaker:'DraftKings',sport:'NBA',league:'NBA',marketType:'player_points',
   outcomeId:'over',startsAt:new Date(now+3600000).toISOString(),playerId:'player-123',line:'22.5',priceAmerican:+150}})};
 const report=await (await d1CoverageGateway(req(),env([rows[0],conflicting]))).json();
 assert.equal(report.ok,true);
 assert.equal(report.independentVerification.crossProviderVerified,true);
 assert.equal(report.independentVerification.priceCrossVerified,false);
 assert.equal(report.independentVerification.priceAlignedOutcomes,0);
 assert.equal(report.independentVerification.priceDisagreementOutcomes,1);
});
test('matching independent prices can be explicitly research-aligned',async()=>{
 const second={...rows[0],source_id:'aligned-other',upstream_id:'another-owner',
  observed_at:new Date(now-9000).toISOString()};
 const report=await (await d1CoverageGateway(req(),env([rows[0],second]))).json();
 assert.equal(report.independentVerification.priceCrossVerified,true);
 assert.equal(report.independentVerification.priceAlignedOutcomes,1);
 assert.equal(report.independentVerification.priceDisagreementOutcomes,0);
});
