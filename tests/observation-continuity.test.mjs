import assert from 'node:assert/strict';
import test from 'node:test';
import {loadProvider} from './helpers/load-provider.mjs';

const observed=loadProvider('../observedOdds');
const {buildObservedOddsSnapshot,mergeObservedOddsSnapshots,OBSERVED_ODDS_MAX_QUOTES}=observed;
const continuity=loadProvider('../liveBoardContinuity');
const now=Date.now();
const quote=(sport='NBA',index=0,extra={})=>({
 id:`${sport}:${index}`,sport,league:sport,event:`${sport} Away @ Home ${Math.floor(index/6)}`,
 selection:`Selection ${index}`,market:'h2h',startTime:new Date(now+3600000).toISOString(),
 odds:-110,sourceBook:'DraftKings',sourceProviderId:'espn-core-odds',sourceEventId:`${sport}-event-${Math.floor(index/6)}`,
 quoteObservedAt:new Date(now-1000).toISOString(),evidenceClass:'OBSERVED_REFERENCE',...extra
});
const quotes=(sport,count,extra={})=>Array.from({length:count},(_,index)=>quote(sport,index,extra));

test('collected later games remain reachable beyond the former 200-row cap',()=>{
 const snapshot=buildObservedOddsSnapshot([...quotes('NCAAB',240),...quotes('NBA',54),...quotes('NFL',96)],now);
 assert.equal(snapshot.referenceCount,390);
 assert.equal(snapshot.coverageDetails.eligibleQuoteCount,390);
 assert.equal(snapshot.coverageDetails.omittedQuoteCount,0);
 assert.equal(snapshot.coverageDetails.sports.find(row=>row.sport==='NBA').returnedQuoteCount,54);
 assert.equal(snapshot.coverageDetails.sports.find(row=>row.sport==='NBA').returnedEventCount,9);
 assert.equal(snapshot.coverage,'PARTIAL');
 assert.equal(snapshot.recommendationsAuthorized,false);
});

test('bounded projection shares return slots across sports and discloses omitted observations',()=>{
 const snapshot=buildObservedOddsSnapshot([
  ...quotes('NCAAB',1100,{startTime:new Date(now+3600000).toISOString()}),
  ...quotes('NBA',54,{startTime:new Date(now+7200000).toISOString()}),
  ...quotes('NHL',12,{startTime:new Date(now+10800000).toISOString()})
 ],now);
 assert.equal(snapshot.referenceCount,OBSERVED_ODDS_MAX_QUOTES);
 assert.equal(snapshot.coverageDetails.eligibleQuoteCount,1166);
 assert.equal(snapshot.coverageDetails.omittedQuoteCount,166);
 assert.equal(snapshot.coverageDetails.upstreamTruncated,false);
 assert.equal(snapshot.coverageDetails.sports.find(row=>row.sport==='NBA').returnedQuoteCount,54);
 assert.equal(snapshot.coverageDetails.sports.find(row=>row.sport==='NHL').returnedQuoteCount,12);
 assert.equal(snapshot.coverageDetails.sports.reduce((sum,row)=>sum+row.returnedQuoteCount,0),snapshot.referenceCount);
 assert.ok(snapshot.referenceQuotes.every((row,index,rows)=>!index||Date.parse(rows[index-1].startTime)<=Date.parse(row.startTime)));
});

test('merged coverage never pretends to recover observations already omitted upstream',()=>{
 const limited=buildObservedOddsSnapshot(quotes('NCAAB',1100),now);
 const merged=mergeObservedOddsSnapshots([limited,limited],now);
 assert.equal(merged.referenceCount,1000);
 assert.equal(merged.coverageDetails.eligibleQuoteCount,1000);
 assert.equal(merged.coverageDetails.omittedQuoteCount,0);
 assert.equal(merged.coverageDetails.upstreamTruncated,true);
 assert.equal(merged.referenceQuotes[0].quoteObservedAt,limited.referenceQuotes[0].quoteObservedAt);
 const expired=mergeObservedOddsSnapshots([limited],now+300000);
 assert.equal(expired.referenceCount,0);
 assert.equal(expired.coverageDetails.eligibleQuoteCount,0);
});

test('new conflict evidence removes rows before the cap and cannot hide a later unaffected selection',()=>{
 const rows=quotes('NCAAB',1000);
 const first=buildObservedOddsSnapshot(rows,now);
 const later=buildObservedOddsSnapshot([quote('NCAAB',1001,{startTime:new Date(now+7200000).toISOString()})],now);
 const conflicts=buildObservedOddsSnapshot(rows.slice(0,10).flatMap(row=>[row,{...row,odds:120}]),now);
 const result=mergeObservedOddsSnapshots([first,later,conflicts],now);
 assert.equal(result.referenceCount,991);
 assert.equal(result.coverageDetails.eligibleQuoteCount,991);
 assert.ok(result.referenceQuotes.some(row=>row.id==='NCAAB:1001'));
 assert.ok(result.referenceQuotes.every(row=>!rows.slice(0,10).some(blocked=>blocked.id===row.id)));
 assert.equal(result.withheldObservations.length,10);
});

const scoreSnapshot=()=>({ok:true,generatedAt:new Date(now).toISOString(),refreshMs:5000,sourceMode:'partial',
 sources:[],liveGames:0,games:[],warnings:[],observedOdds:buildObservedOddsSnapshot([quote()],now),
 collection:{partial:true,deadlineReached:true,deadlineMs:4500,concurrency:6,sources:[]}});
const emptyPulse={ok:false,rows:[],fresh:false,generatedAt:null};
const predictionSnapshot={mode:'live',source:'public-market',contracts:[],attempts:[],sources:[],warnings:[]};

function routeRuntime({ingestOdds=async()=>{throw new Error('private upstream details')},fetchScores=async()=>scoreSnapshot(),scanMarkets=()=>[]}={}){
 const calls={scans:0,cacheReads:0,context:0};
 const emptyAsync=async()=>[];
 const runtime=loadProvider('../../app/api/live-board/route',{
  '@/lib/providers/ingest':{ingestOdds},
  '@/lib/scanner':{scanMarkets:()=>{calls.scans++;return scanMarkets()}},
  '@/lib/boardScoring':{qualifiesForTopBoard:()=>false,rankDaily:()=>[],rankWeekly:()=>[],scoreBoardRows:()=>[]},
  '@/lib/predictionMarkets':{fetchPredictionMarkets:async()=>predictionSnapshot},
  '@/lib/ledger':{loadLedgerHistory:emptyAsync},
  '@/lib/historyAnalytics':loadProvider('../historyAnalytics'),
  '@/lib/anomaly':{detectAnomalies:()=>[]},
  '@/lib/learnedWeights':{loadLearnedWeightMultipliers:async()=>({})},
  '@/lib/providers/contextFusion':{enrichMarketsWithContext:async markets=>{calls.context++;return {markets,diagnostics:{}}}},
  '@/lib/crossMarket':{fusePredictionMarkets:rows=>rows},
  '@/lib/ops':{recordPerformance:async()=>undefined},
  '@/lib/contextChanges':{detectMaterialContextChanges:()=>[],contextRevision:()=>''},
  '@/lib/persistence':{loadContextMarketStates:emptyAsync,recordContextChanges:async()=>0,saveContextMarketStates:async()=>0,recordModelRuns:async()=>0},
  '@/lib/lineMovement':{loadLineMovement:async()=>new Map()},
  '@/lib/alerts':{steamAlert:()=>null},
  '@/lib/learnedSgpCorrelation':{loadLearnedSgpCorrelations:async()=>({})},
  '@/lib/regimeConfidence':{loadDynamicCalibrationProfiles:async()=>({})},
  '@/lib/liveScoreMesh':{fetchLiveScoreMesh:fetchScores,readCachedLiveScoreMesh:()=>{calls.cacheReads++;return scoreSnapshot()}},
  '@/lib/providers/fanLineWire':{fetchFanDuelOddsPulse:async()=>emptyPulse},
  '@/lib/observedOdds':observed,
  '@/lib/liveBoardContinuity':continuity,
  '@/lib/pulseEvidence':loadProvider('../pulseEvidence'),
  '@/lib/intelligence-core/soccer-board-evidence.mjs':{soccerBoardEvidence:()=>({})},
  '@/lib/intelligence-core/soccer-board-identity-adapter.mjs':{resolveSoccerBoardMarkets:rows=>({eligible:rows,withheldSoccerCount:0,gateEnforced:true,evidenceMode:'TEST'})}
 });
 return {...runtime,calls};
}

test('a core failure returns current observations with a complete empty model-board contract',async()=>{
 const runtime=routeRuntime();
 const response=await runtime.GET(new Request('https://edgeforce.test/api/live-board?view=week&limit=50&risk=Aggressive'));
 const body=await response.json();
 assert.equal(response.status,503);
 assert.equal(body.schema,'edgeforce-live-board-v199');
 assert.deepEqual(body.coreStatus,{ok:false,code:'CORE_FAILED',error:'The model-data pipeline failed. Independent source observations remain available when current.'});
 assert.equal(body.observedOdds.referenceCount,1);
 assert.equal(body.observationOnly,true);
 assert.equal(body.observedOdds.referenceQuotes[0].quoteObservedAt,quote().quoteObservedAt);
 assert.equal(body.observedOdds.recommendationsAuthorized,false);
 assert.deepEqual(body.rows,[]);assert.deepEqual(body.sports,[]);assert.deepEqual(body.anomalies,[]);
 assert.equal(body.resimulationTriggered,false);
 assert.equal(body.topBoardQualification.qualified,0);
 assert.equal(body.predictions.source,'public-market');
 assert.ok(body.history.overall);
 assert.equal(body.view,'week');assert.equal(body.limit,50);assert.equal(body.risk,'Aggressive');
 assert.equal(runtime.calls.scans,0);assert.equal(runtime.calls.context,0);
 assert.equal(JSON.stringify(body).includes('private upstream details'),false);
});

test('real deadline rejection preserves observations already collected by the score service',async()=>{
 const savedSetTimeout=globalThis.setTimeout;
 globalThis.setTimeout=(callback,delay,...args)=>savedSetTimeout(callback,Math.min(delay,5),...args);
 try{
  const runtime=routeRuntime({ingestOdds:()=>new Promise(()=>{}),fetchScores:async()=>{throw new Error('score batch incomplete')}});
  const response=await runtime.GET(new Request('https://edgeforce.test/api/live-board'));
  const body=await response.json();
  assert.equal(response.status,503);
  assert.equal(body.coreStatus.code,'CORE_TIMEOUT');
  assert.equal(body.observedOdds.referenceCount,1);
  assert.equal(runtime.calls.cacheReads,1);
  assert.equal(runtime.calls.scans,0);
  assert.equal(body.liveScores.collection.partial,true);
 }finally{globalThis.setTimeout=savedSetTimeout}
});

test('successful ingestion without eligible markets remains explicitly observation-only',async()=>{
 const runtime=routeRuntime({ingestOdds:async()=>({source:'unavailable',mode:'failed',degraded:true,markets:[],referenceMarkets:[],
  warnings:[],attempts:[],providerPanel:[],targetBook:'DraftKings'})});
 const response=await runtime.GET(new Request('https://edgeforce.test/api/live-board'));
 const body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.coreStatus.ok,false);
 assert.equal(body.coreStatus.code,'NO_ELIGIBLE_MARKETS');
 assert.equal(body.observedOdds.referenceCount,1);
 assert.equal(body.observationOnly,true);
 assert.deepEqual(body.rows,[]);
});

test('a downstream model-processing exception cannot discard successful source observations',async()=>{
 const attempt={providerId:'espn-core-odds',ok:false,latencyMs:1,observedReferenceMarkets:1};
 const runtime=routeRuntime({ingestOdds:async()=>({source:'unavailable',mode:'failed',degraded:true,markets:[],referenceMarkets:[quote()],
  warnings:[],attempts:[attempt],providerPanel:[],targetBook:'DraftKings'}),
  fetchScores:async()=>({...scoreSnapshot(),observedOdds:buildObservedOddsSnapshot([],now)}),
  scanMarkets:()=>{throw new Error('private model failure')}});
 const response=await runtime.GET(new Request('https://edgeforce.test/api/live-board'));
 const body=await response.json();
 assert.equal(response.status,503);
 assert.equal(body.coreStatus.code,'CORE_FAILED');
 assert.equal(body.observedOdds.referenceCount,1);
 assert.equal(body.observationOnly,true);
 assert.deepEqual(body.providerAttempts,[attempt]);
 assert.equal(runtime.calls.scans,1);
 assert.deepEqual(body.rows,[]);
 assert.equal(JSON.stringify(body).includes('private model failure'),false);
});

test('core degradation cannot renew expired source observations',()=>{
 const result=continuity.unavailableLiveBoard({view:'today',limit:30,risk:'Moderate',
  coreStatus:{ok:false,code:'CORE_TIMEOUT'},liveScores:scoreSnapshot(),fanduelPulse:emptyPulse,
  predictions:predictionSnapshot,ledgerHistory:[],now:now+300000});
 assert.equal(result.observedOdds.referenceCount,0);
 assert.equal(result.observationOnly,false);
 assert.equal(result.observedOdds.recommendationsAuthorized,false);
});

test('the live and degraded board publish current price review from the same clock as generation',async()=>{
 for(const degraded of [false,true]){
  let acquisitions=0, publishedAt;
  const acquire=async()=>{
   acquisitions++;
   return {source:'unavailable',mode:'failed',degraded:true,markets:[],referenceMarkets:[],warnings:[],attempts:[],providerPanel:[],
    priceReview:{corroboratedMarkets:1},readPriceReview:clock=>{
     publishedAt=clock;
     return {corroboratedMarkets:0,status:'NO_ELIGIBLE_MARKETS'};
    }};
  };
  const runtime=routeRuntime({ingestOdds:acquire,
   fetchScores:async()=>({...scoreSnapshot(),observedOdds:buildObservedOddsSnapshot([],now)}),
   scanMarkets:()=>{if(degraded)throw new Error('model processing failed');return [];}});
  const req=new Request('https://edgeforce.test/api/live-board');
  for(let i=0;i<2;i++){
   const response=await runtime.GET(req);
   const body=await response.json();
   assert.equal(response.status,degraded?503:200);
   assert.equal(body.priceReview.corroboratedMarkets,0);
   assert.equal(body.observationOnly,false);
   assert.equal(Date.parse(body.generatedAt),publishedAt);
  }
  assert.equal(acquisitions,1);
 }
});
