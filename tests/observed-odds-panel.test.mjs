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
const {default:ObservedOddsPanel,hasCurrentBoardSnapshot,currentBoardRows,referenceOddsView}=await import(uri(source));
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
 assert.equal(referenceOddsView({...observedOdds,referenceQuotes:[...referenceQuotes,...referenceQuotes]},now,{limit:1000}).quotes.length,200);
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
