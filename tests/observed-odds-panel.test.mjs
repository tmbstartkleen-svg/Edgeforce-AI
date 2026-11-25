import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';

const compile=path=>ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}
}).outputText;
const uri=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const source=compile('src/components/ObservedOddsPanel.tsx')
 .replaceAll('from "react/jsx-runtime"','from '+JSON.stringify(import.meta.resolve('react/jsx-runtime')))
 .replaceAll("from 'react'",'from '+JSON.stringify(import.meta.resolve('react')))
 .replaceAll("from '@/lib/pulseEvidence'",'from '+JSON.stringify(uri(compile('src/lib/pulseEvidence.ts'))))
 .replaceAll("from '@/lib/observedOdds'",'from '+JSON.stringify(uri(compile('src/lib/observedOdds.ts'))))
 .replaceAll("from '@/lib/dailyWeeklyResearch'",'from '+JSON.stringify(uri(compile('src/lib/dailyWeeklyResearch.ts'))));
const {default:ObservedOddsPanel,acceptsLiveBoardResponse,hasCurrentBoardSnapshot,currentBoardRows,referenceOddsView,providerDiagnosticSummary}=await import(uri(source));
const continuitySource=compile('src/lib/liveBoardContinuity.ts')
 .replaceAll("from './historyAnalytics'",'from '+JSON.stringify(uri(compile('src/lib/historyAnalytics.ts'))))
 .replaceAll("from './observedOdds'",'from '+JSON.stringify(uri(compile('src/lib/observedOdds.ts'))))
 .replaceAll("from './pulseEvidence'",'from '+JSON.stringify(uri(compile('src/lib/pulseEvidence.ts'))));
const {unavailableLiveBoard}=await import(uri(continuitySource));
const now=Date.parse('2026-11-25T12:00:00Z'),iso=n=>new Date(n).toISOString();
const quote={id:'q1',sport:'NBA',league:'NBA',event:'Away at Home',selection:'Home',market:'moneyline',
 startTime:'2026-11-25T20:00:00Z',odds:150,bookmaker:'DraftKings',providerId:'espn-core',sourceEventId:'event-123',
 quoteObservedAt:iso(now-60000),evidenceClass:'OBSERVED_REFERENCE',modelProbability:.999,expectedValue:99};
const snapshot={referenceCount:1,referenceQuotes:[quote],coverage:'PARTIAL',recommendationsAuthorized:false,maxObservationAgeMs:300000};
const render=props=>renderToStaticMarkup(createElement(ObservedOddsPanel,{now,stale:false,loading:false,observedOdds:snapshot,...props}));

test('observed reference prices display actual selection and break-even without model claims',()=>{
 const html=render({});
 assert.match(html,/DraftKings/);assert.match(html,/\+150/);assert.match(html,/40\.0%/);
 assert.match(html,/Home/);assert.match(html,/espn-core/);assert.match(html,/EST/);
 assert.match(html,/Book update time not supplied/);assert.match(html,/Observation only/);
 assert.doesNotMatch(html,/99\.9%|9900|<button|EV ROI|JOINT MODEL/);
});

test('reference observation and bookmaker times stay distinct',()=>{
 const html=render({observedOdds:{...snapshot,referenceQuotes:[{...quote,sourceTimestamp:iso(now-3600000)}]}});
 assert.match(html,/Observed /);assert.match(html,/Book update /);assert.match(html,/60\.0 minutes ago/);
});

test('reference observations expire locally and past starts disappear',()=>{
 assert.doesNotMatch(render({now:now+240001}),/\+150/);
 assert.doesNotMatch(render({observedOdds:{...snapshot,referenceQuotes:[{...quote,startTime:iso(now)}]}}),/\+150/);
 assert.doesNotMatch(render({observedOdds:{...snapshot,referenceQuotes:[{...quote,quoteObservedAt:iso(now+1)}]}}),/\+150/);
});

test('reference quote numeric validation matches the bounded integer projection',()=>{
 for(const odds of [150.5,1e100,null,'150',true,Infinity,NaN]){
  assert.equal(referenceOddsView({...snapshot,referenceQuotes:[{...quote,odds}]},now).current.length,0,String(odds));
 }
 assert.equal(referenceOddsView({...snapshot,referenceQuotes:[{...quote,odds:100}]},now).current.length,1);
});

test('reference table begins with 25 observations and offers local filters and more rows',()=>{
 const referenceQuotes=Array.from({length:40},(_,index)=>({...quote,id:'q'+index,selection:'Selection '+index}));
 const html=render({observedOdds:{...snapshot,referenceCount:40,referenceQuotes}});
 assert.match(html,/Showing 25 of 40 matching current reference observations/);
 assert.match(html,/Reference odds sport/);assert.match(html,/Reference odds market/);
 assert.match(html,/Show more \(15\)/);
 assert.match(html,/Selection 24/);assert.doesNotMatch(html,/Selection 25/);
});

test('local filters and progressive reveal reach all supplied reference sports and markets',()=>{
 const referenceQuotes=Array.from({length:200},(_,index)=>({...quote,id:'q'+index,selection:'Selection '+index,
  sport:index<100?'NBA':'NHL',market:index%2?'spread':'moneyline'}));
 const observedOdds={...snapshot,referenceCount:200,referenceQuotes};
 assert.deepEqual(referenceOddsView(observedOdds,now).sports,['NBA','NHL']);
 for(const limit of [25,50,75,100,125,150,175,200]){
  const view=referenceOddsView(observedOdds,now,{limit});
  assert.equal(view.quotes.length,limit);
  assert.equal(view.quotes.at(-1).selection,'Selection '+(limit-1));
 }
 const filtered=referenceOddsView(observedOdds,now,{sport:'NHL',market:'spread',limit:200});
 assert.equal(filtered.matchingCount,50);
 assert.equal(filtered.quotes.length,50);
 assert.ok(filtered.quotes.every(row=>row.sport==='NHL'&&row.market==='spread'));
 assert.equal(filtered.quotes.at(-1).selection,'Selection 199');
 assert.equal(referenceOddsView(observedOdds,now,{sport:'NBA',market:'totals'}).matchingCount,0);
 assert.equal(referenceOddsView({...observedOdds,referenceQuotes:[...referenceQuotes,...referenceQuotes]},now,{limit:1000}).quotes.length,400);
});

test('all 1000 supplied quotes remain reachable, including sports beyond the old 200 cutoff',()=>{
 const referenceQuotes=Array.from({length:1000},(_,index)=>({...quote,id:'q'+index,selection:'Selection '+index,
  sport:index<946?'NCAAB':'NBA'}));
 const observedOdds={...snapshot,referenceCount:1000,referenceQuotes};
 const all=referenceOddsView(observedOdds,now,{limit:1000});
 assert.equal(all.current.length,1000);assert.equal(all.quotes.length,1000);
 assert.equal(all.quotes.at(-1).selection,'Selection 999');
 const nba=referenceOddsView(observedOdds,now,{sport:'NBA',limit:75});
 assert.equal(nba.suppliedCount,1000);assert.equal(nba.matchingSuppliedCount,54);
 assert.equal(nba.matchingCount,54);assert.equal(nba.quotes.length,54);
 assert.equal(nba.quotes.at(-1).selection,'Selection 999');
});

test('expiry, event starts and invalid evidence are counted separately and retain sport filters',()=>{
 const referenceQuotes=[quote,{...quote,id:'expired',sport:'NFL',quoteObservedAt:iso(now-300001)},
  {...quote,id:'started',sport:'NHL',startTime:iso(now)},
  {...quote,id:'unverified',sport:'SOCCER',quoteObservedAt:iso(now+1)}];
 const observedOdds={...snapshot,referenceCount:4,referenceQuotes};
 const view=referenceOddsView(observedOdds,now);
 assert.equal(view.suppliedCount,4);assert.equal(view.current.length,1);
 assert.equal(view.expiredCount,1);assert.equal(view.startedCount,1);assert.equal(view.unverifiedCount,1);
 assert.deepEqual(view.sports,['NBA','NFL','NHL','SOCCER']);
 const expired=referenceOddsView(observedOdds,now,{sport:'NFL'});
 assert.equal(expired.matchingSuppliedCount,1);assert.equal(expired.matchingCount,0);
 assert.deepEqual(expired.markets,['moneyline']);
 const html=render({observedOdds});
 assert.match(html,/1 current of 4 returned quotes/);
 assert.match(html,/1 expired; 1 removed after the event start; 1 unverified/);
 const expiredHtml=render({now:now+240001});
 assert.match(expiredHtml,/No returned quote matching these filters is current/);
 assert.doesNotMatch(expiredHtml,/No current reference prices were returned/);
});

test('coverage discloses collected counts, response omissions and unknown upstream losses',()=>{
 const referenceQuotes=Array.from({length:42},(_,index)=>({...quote,id:'q'+index,selection:'Selection '+index}));
 const observedOdds={...snapshot,referenceCount:42,referenceQuotes,coverageDetails:{
  eligibleQuoteCount:60,returnedQuoteCount:42,omittedQuoteCount:18,upstreamTruncated:true,
  sports:[{sport:'NBA',eligibleQuoteCount:54,returnedQuoteCount:42,eligibleEventCount:9,returnedEventCount:7},
   {sport:'NHL',eligibleQuoteCount:6,returnedQuoteCount:0,eligibleEventCount:1,returnedEventCount:0}]
 }};
 const html=render({observedOdds});
 assert.match(html,/42 of 60 eligible collected quotes returned/);
 assert.match(html,/18 omitted by the response limit/);
 assert.match(html,/exact number omitted before this response is unknown/);
 assert.match(html,/Full league and bookmaker coverage remains unverified/);
 assert.match(html,/7 \/ 9/);assert.match(html,/0 \/ 1/);
 assert.ok(referenceOddsView(observedOdds,now).sports.includes('NHL'));
 const nba=referenceOddsView(observedOdds,now).sportCoverage.find(row=>row.sport==='NBA');
 assert.equal(nba.currentQuoteCount,42);assert.equal(nba.receivedQuoteCount,42);assert.equal(nba.eligibleQuoteCount,54);
});

test('pulse prices retain selection IDs and exclude closed, invalid and expired observations',()=>{
 const pulseRow={sport:'NBA',fixture:'fixture-456',market:'moneyline',status:'OPEN',inplay:false,
  updatedAt:iso(now-10000),prices:[{selectionId:'unmapped-42',american:-110},{selectionId:'missing-price',american:null}]};
 const pulse={ok:true,fresh:true,generatedAt:iso(now-30000),rows:[pulseRow,{...pulseRow,status:'CLOSED',fixture:'closed-fixture'}]};
 const html=render({pulse});
 assert.match(html,/unmapped-42/);assert.match(html,/-110/);assert.match(html,/Outcome name unverified/);
 assert.doesNotMatch(html,/missing-price|closed-fixture/);
 assert.doesNotMatch(render({pulse,now:now+90001}),/unmapped-42/);
});

test('provider errors and failed snapshot are visible without action controls',()=>{
 const html=render({stale:true,providerAttempts:[{providerId:'the-odds-api',ok:false,skipped:true,circuitState:'OPEN',error:'Quota exhausted; remaining=0'}]});
 assert.match(html,/Last snapshot/);assert.match(html,/recommendation controls are unavailable/);
 assert.match(html,/the-odds-api/);assert.match(html,/Quota exhausted; remaining=0/);assert.match(html,/Paused/);
 assert.doesNotMatch(html,/<button/);
});

test('reference-only provider responses retain their reason without claiming normalized availability',()=>{
 const html=render({providerAttempts:[{providerId:'espn-scoreboard',ok:false,observedReferenceMarkets:12,
  error:'Bookmaker update time missing; observations retained for reference'}]});
 assert.match(html,/Reference only/);
 assert.match(html,/Bookmaker update time missing; observations retained for reference/);
 assert.doesNotMatch(html,/>Unavailable<|>Response accepted</);
});

test('network diagnostics identify the free preflight without fabricating HTTP or quota evidence',()=>{
 const diagnostics={schemaVersion:1,cacheHit:false,cacheAgeMs:0,failureKind:'NETWORK',quotaEvidence:'UNAVAILABLE',
  requests:[{stage:'PREFLIGHT',endpoint:'SPORTS_CATALOG',attempted:true,responseReceived:false,
   startedAt:iso(now-1000),elapsedMs:1000,httpStatus:503,responseBytes:0,quota:{remaining:0},failureKind:'NETWORK',failurePhase:'REQUEST'}]};
 const lines=providerDiagnosticSummary(diagnostics,now).join(' ');
 assert.match(lines,/Network request failed/);assert.match(lines,/Free quota preflight: No HTTP response received/);
 assert.match(lines,/remaining credits are unverified/);assert.doesNotMatch(lines,/HTTP 503|0 credits remaining|quota exhausted/i);
 const html=render({providerAttempts:[{providerId:'the-odds-api',ok:false,error:'Free preflight request failed',diagnostics}]});
 assert.match(html,/Network request failed/);assert.doesNotMatch(html,/HTTP 503|0 credits remaining/);
});

test('current and cached quota balances require an observed HTTP response and advance in age',()=>{
 const observedAt=iso(now-60000),request={stage:'PREFLIGHT',endpoint:'SPORTS_CATALOG',attempted:true,responseReceived:true,
  startedAt:iso(now-61000),observedAt,elapsedMs:1000,httpStatus:200,responseBytes:64,quota:{remaining:0}};
 const diagnostics={schemaVersion:1,cacheHit:true,cacheAgeMs:60000,failureKind:'QUOTA_EXHAUSTED',quotaEvidence:'CACHED_RESPONSE',quotaObservedAt:observedAt,requests:[request]};
 const lines=providerDiagnosticSummary(diagnostics,now).join(' ');
 assert.match(lines,/Free quota preflight: HTTP 200/);assert.match(lines,/cached provider response · 0 credits remaining/);
 assert.match(lines,/1\.0 minutes ago/);
 assert.match(providerDiagnosticSummary(diagnostics,now+60000).join(' '),/2\.0 minutes ago/);
 assert.match(providerDiagnosticSummary({...diagnostics,cacheHit:false,quotaEvidence:'CURRENT_RESPONSE'},now).join(' '),/latest provider response/);
 for(const changed of [{quotaObservedAt:iso(now+1)},{quotaObservedAt:undefined},
  {requests:[{...request,responseReceived:false}]},{requests:[{...request,quota:{remaining:'0'}}]}]){
  assert.doesNotMatch(providerDiagnosticSummary({...diagnostics,...changed},now).join(' '),/0 credits remaining/);
 }
});

test('source collection reports cache, failures and deferred attempts independently of quote freshness',()=>{
 const html=render({observedOdds:{...snapshot,referenceQuotes:[{...quote,quoteObservedAt:iso(now-300001)}]},collection:{
  partial:true,deadlineReached:true,deadlineMs:5000,concurrency:4,sources:[
   {id:'espn:nba',label:'NBA',status:'CACHED',gameCount:9,referenceCount:54,observedAt:iso(now-600000)},
   {id:'espn:nhl',label:'NHL',status:'FAILED',gameCount:0,referenceCount:0,error:'Request timed out'},
   {id:'espn:mlb',label:'MLB',status:'DEFERRED',gameCount:0,referenceCount:0}
  ]}});
 assert.match(html,/partial response/);assert.match(html,/response deadline reached/);
 assert.match(html,/>CACHED</);assert.match(html,/>FAILED</);assert.match(html,/>DEFERRED</);
 assert.match(html,/Request timed out/);assert.match(html,/10\.0 minutes ago/);
 assert.match(html,/0 current of 1 returned quotes/);assert.doesNotMatch(html,/\+150/);
});

const responseBody=unavailableLiveBoard({view:'today',limit:30,risk:'Moderate',now,
 coreStatus:{ok:false,code:'CORE_TIMEOUT',error:'Model pipeline deadline reached'},
 liveScores:{ok:true,generatedAt:iso(now),games:[],observedOdds:snapshot},fanduelPulse:{ok:false,rows:[]},
 predictions:{mode:'unavailable',source:null,contracts:[]},ledgerHistory:[]});

test('a structured degraded503 preserves current observations while all core action gates stay closed',()=>{
 assert.equal(acceptsLiveBoardResponse(responseBody,503),true);
 assert.equal(hasCurrentBoardSnapshot(responseBody.generatedAt,now),true);
 assert.equal(hasCurrentBoardSnapshot(responseBody.generatedAt,now,false,responseBody.coreStatus),false);
 const validRow={id:'m1',sport:'NBA',event:'A at B',selection:'A',market:'h2h',startTime:iso(now+3600000),
  sourceTimestamp:iso(now-60000),sourceAgeMin:1};
 assert.deepEqual(currentBoardRows([validRow],responseBody.generatedAt,now,false,responseBody.coreStatus),[]);
 const html=render({coreStatus:responseBody.coreStatus});
 assert.match(html,/\+150/);assert.match(html,/The model board is unavailable/);
 assert.match(html,/model action controls are unavailable/);
 assert.doesNotMatch(html,/Last snapshot|latest observation response failed/);
});

test('degraded response admission rejects other failures, nonempty model rows and malformed envelopes',()=>{
 for(const status of [400,401,403,404,429,500,502,504])assert.equal(acceptsLiveBoardResponse(responseBody,status),false,String(status));
 for(const patch of [{schema:undefined},{coreStatus:undefined},{coreStatus:{ok:true,code:'READY'}},
  {coreStatus:{ok:false,code:'READY'}},{coreStatus:{ok:false,code:'UNKNOWN'}},
  {rows:[{id:'old-market'}]},{sports:['NBA']},{history:undefined},{predictions:undefined}]){
  assert.equal(acceptsLiveBoardResponse({...responseBody,...patch},503),false,JSON.stringify(patch));
 }
 assert.equal(acceptsLiveBoardResponse({...responseBody,coreStatus:{ok:false,code:'NO_ELIGIBLE_MARKETS'}},200),true);
 assert.equal(acceptsLiveBoardResponse({...responseBody,coreStatus:{ok:true,code:'READY'},source:'live'},200),true);
 assert.equal(acceptsLiveBoardResponse({...responseBody,coreStatus:null},200),false);
 assert.equal(acceptsLiveBoardResponse({},200),false);
 assert.equal(acceptsLiveBoardResponse(null,503),false);
});

test('failed or expired board snapshots cannot retain actionable rows',()=>{
 const generatedAt=iso(now),row={id:'m1',sport:'NBA',event:'A at B',selection:'A',market:'h2h',
  startTime:iso(now+3600000),sourceTimestamp:iso(now-60000),sourceAgeMin:1};
 const rows=[row];
 assert.equal(hasCurrentBoardSnapshot(generatedAt,now),true);
 assert.equal(currentBoardRows(rows,generatedAt,now),rows);
 assert.equal(currentBoardRows(rows,generatedAt,now+15000),rows);
 assert.deepEqual(currentBoardRows(rows,generatedAt,now,true),[]);
 assert.deepEqual(currentBoardRows(rows,generatedAt,now+120001),[]);
 assert.deepEqual(currentBoardRows([{...row,sourceTimestamp:iso(now-1200001)}],generatedAt,now),[]);
 assert.deepEqual(currentBoardRows([{...row,startTime:iso(now)}],generatedAt,now),[]);
 assert.deepEqual(currentBoardRows([{...row,sourceTimestamp:undefined}],generatedAt,now),[]);
 assert.equal(hasCurrentBoardSnapshot(iso(now+1),now),false);
});
