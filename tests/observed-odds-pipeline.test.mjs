import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {loadProvider} from './helpers/load-provider.mjs';

const {normalizeOddsPayload}=loadProvider('normalizeOdds');
const {buildObservedOddsSnapshot,mergeObservedOddsSnapshots}=loadProvider('../observedOdds');
const now=Date.now();
const observedAt=new Date(now-1000).toISOString();
const config={id:'espn-core-odds',name:'ESPN Core Odds',capability:'ODDS',priority:95,
 enabled:true,bookmaker:'ESPN Core',maxAgeMin:5,timeoutMs:6000,failureThreshold:3,quarantineMin:2,marketRole:'REFERENCE',consensusWeight:.85};
const reference=(overrides={})=>({id:'espn:e1:h2h:home:DraftKings',eventId:'e1',sport:'NBA',league:'NBA',
 event:'Away @ Home',home:'Home',away:'Away',selection:'Home',market:'h2h',
 startTime:new Date(now+3600000).toISOString(),odds:-116,bookmaker:'DraftKings',
 evidenceClass:'OBSERVED_REFERENCE',quoteObservedAt:observedAt,pulledAt:observedAt,liveEligible:false,...overrides});
const normalized=(rows)=>normalizeOddsPayload(rows).markets.map(m=>({...m,sourceProviderId:config.id}));

test('retrieval time never becomes a bookmaker update time for observed quotes',()=>{
 const [row]=normalized([reference()]);
 assert.equal(row.sourceTimestamp,undefined);
 assert.equal(row.sourceAgeMin,Infinity);
 assert.equal(row.quoteObservedAt,observedAt);
 assert.equal(row.evidenceClass,'OBSERVED_REFERENCE');
 const result=buildObservedOddsSnapshot([row],now);
 assert.equal(result.referenceCount,1);
 assert.equal(result.recommendationsAuthorized,false);
 assert.equal(result.referenceQuotes[0].bookmaker,'DraftKings');
 for(const field of ['modelProb','marketProb','expectedValue','confidence','recommendedStake','consensus']){
  assert.equal(Object.hasOwn(result.referenceQuotes[0],field),false,field+' must not escape as reference evidence');
 }
});

test('observed quote serialization rejects expired, future, unzoned, started and malformed evidence',()=>{
 const rows=normalized([
  reference({id:'old',quoteObservedAt:new Date(now-300001).toISOString()}),
  reference({id:'future',quoteObservedAt:new Date(now+1).toISOString()}),
  reference({id:'unzoned',quoteObservedAt:observedAt.replace('Z','')}),
  reference({id:'started',startTime:new Date(now).toISOString()}),
  reference({id:'bad-price',odds:99}),
  reference({id:'missing-event',eventId:''}),
  reference({id:'missing-book',bookmaker:''})
 ]);
 assert.equal(buildObservedOddsSnapshot(rows,now).referenceCount,0);
});

test('duplicate reference observations collapse and conflicting latest prices are withheld',()=>{
 const a=reference(),b=reference({odds:120});
 assert.equal(buildObservedOddsSnapshot(normalized([a,a]),now).referenceCount,1);
 assert.equal(buildObservedOddsSnapshot(normalized([a,b]),now).referenceCount,0);
 assert.equal(buildObservedOddsSnapshot(normalized([b,a]),now).referenceCount,0);
 const corrected=reference({odds:140,quoteObservedAt:new Date(now-500).toISOString()});
 assert.equal(buildObservedOddsSnapshot(normalized([corrected,a,b]),now).referenceQuotes[0].odds,140);
});

test('conflicting newer snapshots cannot revive an old reference quote when merged',()=>{
 const older=buildObservedOddsSnapshot(normalized([reference({quoteObservedAt:new Date(now-2000).toISOString()})]),now);
 const conflict=buildObservedOddsSnapshot(normalized([reference(),reference({odds:120})]),now);
 assert.equal(conflict.referenceCount,0);
 assert.equal(mergeObservedOddsSnapshots([older,conflict],now).referenceCount,0);
 assert.equal(mergeObservedOddsSnapshots([conflict,older],now).referenceCount,0);
 const later=buildObservedOddsSnapshot(normalized([reference({odds:140,quoteObservedAt:new Date(now-500).toISOString()})]),now);
 const merged=mergeObservedOddsSnapshots([mergeObservedOddsSnapshots([older,conflict],now),later],now);
 assert.equal(merged.referenceCount,1);
 assert.equal(merged.referenceQuotes[0].odds,140);
 assert.equal(merged.withheldObservations.length,0);
});

test('reference identity preserves separate sports and leagues',()=>{
 const snapshot=buildObservedOddsSnapshot(normalized([
  reference(),reference({sport:'NCAAB',league:'NCAAB',odds:120}),reference({sport:'NBA',league:'NBA preseason',odds:140})
 ]),now);
 assert.equal(snapshot.referenceCount,3);
});

test('observed references cannot change eligible market probabilities during normalization',()=>{
 const eligible=reference({id:'priced',evidenceClass:undefined,sourceTimestamp:observedAt});
 const baseline=normalized([eligible])[0];
 const mixed=normalized([eligible,reference()]).find(x=>x.id==='priced');
 assert.equal(mixed.marketProb,baseline.marketProb);
 assert.equal(mixed.modelProb,baseline.modelProb);
});

test('reference-only provider cannot become certified normalized odds',async()=>{
 const {certifyProvider,evaluateCertificationResults}=loadProvider('../providerCertification',{
  './db':{db:()=>null},'./providers/config':{configuredProviders:()=>[config]},
  './providers/http':{fetchProviderJson:async()=>({ok:true,data:[reference()],latencyMs:1,status:200})},
  './releaseManifest':{RELEASE:{}},'./persistence':{latestStoredMarkets:async()=>[]},
  './dataQuality':{auditMarketBatch:()=>({})},'./providers/fanLineWire':{fetchFanDuelOddsPulse:async()=>null}
 });
 const certified=await certifyProvider(config);
 assert.equal(certified.status,'CAUTION');
 assert.equal(certified.normalizedCount,0);
 assert.equal(certified.referenceCount,1);
 assert.equal(certified.qualityGrade,'CAUTION');
 assert.equal(certified.payloadAgeMin,undefined);
 assert.equal(evaluateCertificationResults([certified]).launchReady,false);
});

test('reference observations never enter the consensus panel or eligible markets',async()=>{
 const consensusInputs=[];
 const {fetchNormalizedOdds}=loadProvider('odds',{
  './config':{configuredProviders:()=>[config]},
  './http':{fetchProviderJson:async()=>({ok:true,providerId:config.id,data:[reference()],latencyMs:1,status:200})},
  './healthStore':{loadProviderHealthStates:async()=>new Map(),recordProviderResult:async()=>{}},
  '../marketConsensus':{buildConsensusMarkets:rows=>{consensusInputs.push(rows);return rows}}
 });
 const result=await fetchNormalizedOdds();
 assert.equal(result.markets.length,0);
 assert.equal(result.panelMarkets.length,0);
 assert.equal(result.referenceMarkets.length,1);
 assert.equal(result.providerPanel[0].observedReferenceMarkets,1);
 assert.equal(result.attempts[0].acceptedMarkets,0);
 assert.equal(consensusInputs.length,0);
});

test('mixed provider payload sends only actual market rows into consensus',async()=>{
 const eligible=reference({id:'provider-priced',evidenceClass:undefined,sourceTimestamp:observedAt});
 let consensusInput=[];
 const {fetchNormalizedOdds}=loadProvider('odds',{
  './config':{configuredProviders:()=>[config]},
  './http':{fetchProviderJson:async()=>({ok:true,providerId:config.id,data:[reference(),eligible],latencyMs:1,status:200})},
  './healthStore':{loadProviderHealthStates:async()=>new Map(),recordProviderResult:async()=>{}},
  '../marketConsensus':{buildConsensusMarkets:rows=>{consensusInput=rows;return rows}}
 });
 const result=await fetchNormalizedOdds();
 assert.equal(result.mode,'live');
 assert.equal(consensusInput.length,1);
 assert.equal(consensusInput[0].id,'provider-priced');
 assert.equal(result.referenceMarkets.length,1);
});

test('fresh reference observations cannot certify or admit stale eligible odds',async()=>{
 const staleAt=new Date(now-86400000).toISOString();
 const payload=[reference(),reference({id:'stale-priced',evidenceClass:undefined,pulledAt:staleAt,sourceTimestamp:staleAt})];
 const {certifyProvider,evaluateCertificationResults}=loadProvider('../providerCertification',{
  './db':{db:()=>null},'./providers/config':{configuredProviders:()=>[config]},
  './providers/http':{fetchProviderJson:async()=>({ok:true,data:payload,latencyMs:1,status:200})},
  './releaseManifest':{RELEASE:{}},'./persistence':{latestStoredMarkets:async()=>[]},
  './dataQuality':{auditMarketBatch:()=>({})},'./providers/fanLineWire':{fetchFanDuelOddsPulse:async()=>null}
 });
 const certification=await certifyProvider(config);
 assert.equal(certification.status,'FAILED');
 assert.ok(certification.payloadAgeMin>=1439);
 assert.equal(evaluateCertificationResults([certification]).launchReady,false);
 let consensusCalls=0;
 const {fetchNormalizedOdds}=loadProvider('odds',{
  './config':{configuredProviders:()=>[config]},
  './http':{fetchProviderJson:async()=>({ok:true,providerId:config.id,data:payload,latencyMs:1,status:200})},
  './healthStore':{loadProviderHealthStates:async()=>new Map(),recordProviderResult:async()=>{}},
  '../marketConsensus':{buildConsensusMarkets:rows=>{consensusCalls++;return rows}}
 });
 const result=await fetchNormalizedOdds();
 assert.equal(result.markets.length,0);
 assert.equal(result.referenceMarkets.length,1);
 assert.equal(consensusCalls,0);
});

test('production reference-only ingestion performs no odds persistence or warehouse mirroring',async()=>{
 const previous=process.env.DEPLOYMENT_ENV;process.env.DEPLOYMENT_ENV='production';
 let writes=0;
 const observations=normalized([reference()]);
 const {ingestOdds}=loadProvider('ingest',{
  './odds':{fetchNormalizedOdds:async()=>({mode:'failed',markets:[],panelMarkets:[],referenceMarkets:observations,warnings:[],attempts:[],degraded:true})},
  '../persistence':{latestStoredMarkets:async()=>[],saveMarketSnapshots:async()=>{writes++},saveConsensusMarketSnapshots:async()=>{writes++}},
  '../demo':{demoMarkets:[]},'../intelligence-core/live-odds-adapter':{mirrorLiveOddsToIntelligence:async()=>{writes++}}
 });
 try{
  const result=await ingestOdds();
  assert.equal(result.source,'unavailable');
  assert.equal(result.markets.length,0);
  assert.equal(result.referenceMarkets.length,1);
  assert.equal(writes,0);
 }finally{if(previous===undefined)delete process.env.DEPLOYMENT_ENV;else process.env.DEPLOYMENT_ENV=previous}
});

test('score mesh recovers observed odds from existing score requests without extra odds calls or cache rejuvenation',async()=>{
 const savedFetch=globalThis.fetch,SavedDate=Date;
 let clock=now;
 globalThis.Date=class extends SavedDate{
  constructor(...args){super(...(args.length?args:[clock]))}
  static now(){return clock}
 };
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/espn-scoreboard-modern-odds.json',import.meta.url),'utf8'));
 // Keep the captured provider structure while placing schedules after the test clock.
 for(const event of fixture.events){
  event.date=new Date(now+3600000).toISOString();
  event.competitions[0].date=event.date;
 }
 const calls=[];
 let fail=false;
 globalThis.fetch=async url=>{
  calls.push(String(url));
  if(fail)throw new Error('mock network unavailable');
  if(String(url).includes('/basketball/nba/scoreboard'))return new Response(JSON.stringify(fixture),{status:200});
  if(String(url).includes('/v1/score/now'))return new Response(JSON.stringify({games:[]}),{status:200});
  if(String(url).includes('statsapi.mlb.com'))return new Response(JSON.stringify({dates:[]}),{status:200});
  throw new Error('Unexpected network request '+url);
 };
 const {fetchLiveScoreMesh}=loadProvider('../liveScoreMesh',{
  './sportRegistry':{ESPN_SCOREBOARD_FEEDS:[{id:'nba',sportSlug:'basketball',leagueSlug:'nba',label:'NBA'}],sportCoverageSummary:()=>({})},
  './providers/sportScore':{fetchSportScoreBackup:async()=>({enabled:false,games:[],warnings:[]})},
  './providers/communityScoreBackups':{fetchCommunityScoreBackups:async()=>({games:[],warnings:[],sourceState:[]})}
 });
 try{
  const first=await fetchLiveScoreMesh();
  assert.equal(first.observedOdds.referenceCount,54);
  assert.equal(calls.length,3,'only existing NBA, NHL and MLB score requests');
  assert.ok(calls.every(url=>!url.includes('/odds')));
  assert.ok(first.observedOdds.referenceQuotes.every(q=>q.sourceTimestamp===undefined));
  const observed=first.observedOdds.referenceQuotes[0].quoteObservedAt;
  clock+=10000;
  const cached=await fetchLiveScoreMesh();
  assert.equal(calls.length,3);
  assert.equal(cached.observedOdds.referenceQuotes[0].quoteObservedAt,observed);
  fail=true;clock+=310000;
  const expired=await fetchLiveScoreMesh();
  assert.equal(expired.observedOdds.referenceCount,0);
 }finally{globalThis.fetch=savedFetch;globalThis.Date=SavedDate}
});
