import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createOperationsRequestScope} from '../src/lib/operations-request.mjs';

const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const source=fs.readFileSync(new URL('../src/lib/dailyWeeklyResearch.ts',import.meta.url),'utf8');
const js=transpile(source);
const {buildDailyWeeklyResearch,eventSession,isTodayResearchRow,isStrictResearchRow,contextForResearchRow,formatResearchRoi,researchSourceAge}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

const now=new Date('2026-11-24T12:00:00Z');
const qualification={forced:false,allowedGrades:['ELITE','STRONG'],minimumSimProbability:.52,minimumDynamicConfidence:.50};
const options={now,snapshotAt:now.toISOString(),qualification};
const rows=[
 {id:'m1',sport:'NBA',event:'A @ B',selection:'A',market:'spread',startTime:'2026-11-24T15:00:00Z',bucket:'TODAY',grade:'ELITE',simProbability:.60,dynamicConfidence:.65,odds:-110,freshness:'FRESH',sourceAgeMin:2},
 {id:'m2',sport:'NFL',event:'C @ D',selection:'D',market:'moneyline',startTime:'2026-11-26T23:00:00Z',bucket:'WEEK',grade:'WATCH',simProbability:.51,dynamicConfidence:.60,odds:110,freshness:'FRESH',sourceAgeMin:2}
];
const changes=[{marketId:'m1',event:'A @ B',selection:'A',sport:'NBA',severity:'ACTION',type:'injury',reason:'starter status changed',detectedAt:'2026-11-24T11:00:00Z'}];

test('daily and seven-day filters preserve supplied evidence and fallback status',()=>{
 const today=buildDailyWeeklyResearch(rows,changes,{...options,scope:'today'});
 assert.equal(today.visible,1);
 assert.equal(today.strict,1);
 assert.equal(today.contextFlagged,1);
 assert.equal(today.materialContextFlagged,1);
 const week=buildDailyWeeklyResearch(rows,changes,{...options,scope:'week',qualification:{...qualification,forced:true}});
 assert.equal(week.visible,2);
 assert.equal(week.strict,0);
 assert.equal(week.fallback,2);
 assert.equal(buildDailyWeeklyResearch(rows,changes,{...options,scope:'week',sport:'NFL',session:'PM'}).rows[0].row.id,'m2');
});

test('Eastern calendar dates override rolling TODAY buckets and client timezone',()=>{
 const easternNight=new Date('2026-11-25T03:00:00Z'); // Nov 24, 10 PM Eastern.
 const sameDay={...rows[0],startTime:'2026-11-25T04:59:00Z',bucket:'WEEK'};
 const tomorrow={...rows[0],id:'tomorrow',startTime:'2026-11-25T05:00:00Z',bucket:'TODAY'};
 const yesterday={...rows[0],id:'yesterday',startTime:'2026-11-23T15:00:00Z',bucket:'TODAY'};
 assert.equal(isTodayResearchRow(sameDay,easternNight),true);
 assert.equal(isTodayResearchRow(tomorrow,easternNight),false);
 assert.equal(isTodayResearchRow(yesterday,easternNight),false);
 const report=buildDailyWeeklyResearch([sameDay,tomorrow,yesterday],[],{...options,now:easternNight,scope:'today'});
 assert.deepEqual(report.rows.map(x=>x.row.id),['m1']);
});

test('seven-day scope excludes past starts and day eight at daylight-saving and year boundaries',()=>{
 for(const [start,lastIncluded,firstExcluded] of [
  ['2026-03-07T16:00:00Z','2026-03-14T03:59:59Z','2026-03-14T04:00:00Z'],
  ['2026-11-01T04:30:00Z','2026-11-08T04:59:59Z','2026-11-08T05:00:00Z'],
  ['2026-12-29T16:00:00Z','2027-01-05T04:59:59Z','2027-01-05T05:00:00Z']
 ]){
  const current=new Date(start);
  const input=[
   {...rows[0],id:'past',startTime:new Date(current.getTime()-1).toISOString()},
   {...rows[0],id:'now',startTime:start},
   {...rows[0],id:'upcoming',startTime:new Date(current.getTime()+1).toISOString()},
   {...rows[0],id:'last',startTime:lastIncluded},
   {...rows[0],id:'beyond',startTime:firstExcluded}
  ];
  const report=buildDailyWeeklyResearch(input,[],{...options,scope:'week',now:current});
  assert.deepEqual(report.rows.map(x=>x.row.id),['upcoming','last'],start);
 }
});

test('AM and PM derive from zoned event time; missing or unzoned starts remain unknown',()=>{
 assert.equal(eventSession({...rows[0],period:'PM'}),'AM');
 assert.equal(eventSession({...rows[0],startTime:'2026-11-24T17:00:00Z',period:'AM'}),'PM');
 for(const startTime of ['', 'TBD', '2026-11-24T15:00:00']){
  const row={...rows[0],startTime,period:'PM'};
  assert.equal(eventSession(row),'UNKNOWN');
  const report=buildDailyWeeklyResearch([row],[],{...options,scope:'week'});
  assert.equal(report.visible,0);
  assert.equal(report.unknownStartTimes,1);
 }
});

test('board qualification requires complete explicit gates, valid numbers, current quotes and ready context',()=>{
 assert.equal(isStrictResearchRow(rows[0],qualification),true);
 for(const q of [undefined,null,{}, {...qualification,forced:true}, {...qualification,forced:undefined},
  {...qualification,allowedGrades:[]}, {...qualification,minimumSimProbability:undefined},
  {...qualification,minimumDynamicConfidence:NaN}, {...qualification,minimumSimProbability:1.2}]){
  assert.equal(isStrictResearchRow(rows[0],q),false,JSON.stringify(q));
 }
 for(const patch of [
  {simProbability:.519},{dynamicConfidence:.499},{simProbability:null},{simProbability:'0.60'},
  {simProbability:1.2},{dynamicConfidence:Infinity},{sourceAgeMin:undefined},{sourceAgeMin:-1},
  {sourceAgeMin:20.01},{freshness:undefined},{freshness:'STALE'},{odds:0},{odds:-50},{odds:110.5},
  {contextQuality:{recommendationReady:false}},{contextQuality:{}},{grade:'WATCH'},{grade:['ELITE']},{grade:'elite'}
 ])assert.equal(isStrictResearchRow({...rows[0],...patch},qualification),false,JSON.stringify(patch));
 assert.equal(isStrictResearchRow({...rows[0],simProbability:.52,dynamicConfidence:.50,sourceAgeMin:20,freshness:'AGING'},qualification),true);
});

test('source age advances from snapshot time and unknown snapshot timestamps never qualify',()=>{
 const row={...rows[0],sourceAgeMin:19,freshness:'AGING'};
 const snapshotAt=new Date(now.getTime()-2*60000).toISOString();
 assert.equal(researchSourceAge(row,snapshotAt,now),21);
 const expired=buildDailyWeeklyResearch([row],[],{...options,snapshotAt});
 assert.equal(expired.strict,0);
 assert.equal(expired.rows[0].freshness,'STALE');
 for(const invalid of [undefined,'invalid','2026-11-24T12:00:00',new Date(now.getTime()+31000).toISOString()]){
  const report=buildDailyWeeklyResearch([rows[0]],[],{...options,snapshotAt:invalid});
  assert.equal(report.visible,1);
  assert.equal(report.strict,0);
  assert.equal(report.rows[0].freshness,'UNVERIFIED');
 }
});

test('context flags with different market IDs cannot attach via similar event text',()=>{
 const wrongId={...changes[0],marketId:'other-prop'};
 const eventLevel={...changes[0],marketId:undefined,selection:undefined,detectedAt:undefined};
 const matched=contextForResearchRow(rows[0],[eventLevel,wrongId,...changes]);
 assert.equal(matched.length,2);
 assert.equal(matched[0],changes[0]);
 assert.equal(matched[1],eventLevel);
 assert.equal(contextForResearchRow(rows[1],changes).length,0);
});

test('expected value always formats fractional ROI without changing units above 100 percent',()=>{
 for(const [value,formatted] of [[.025,'2.5%'],[1,'100.0%'],[1.25,'125.0%'],[-.15,'-15.0%'],[0,'0.0%']]){
  assert.equal(formatResearchRoi(value),formatted);
 }
 for(const value of [undefined,null,NaN,Infinity,'0.02'])assert.equal(formatResearchRoi(value),'—');
});

test('shared request scope rejects superseded and unmounted responses even if transport ignores abort',async()=>{
 const scope=createOperationsRequestScope();
 const older=scope.begin(),newer=scope.begin();
 assert.equal(older.signal.aborted,true);
 assert.equal(older.isCurrent(),false);
 assert.equal(newer.isCurrent(),true);
 scope.reset();
 await Promise.resolve();
 assert.equal(newer.signal.aborted,true);
 assert.equal(newer.isCurrent(),false);
 older.finish();newer.finish();
});

test('cockpit shares one abortable snapshot, distinguishes loading and limits its coverage claims',()=>{
 const cockpit=fs.readFileSync(new URL('../src/components/DailyWeeklyResearchCockpit.tsx',import.meta.url),'utf8');
 assert.equal((cockpit.match(/\/api\/live-board\?view=week&limit=50&risk=Moderate/g)||[]).length,1);
 assert.doesNotMatch(cockpit,/\/api\/context-changes|orders\.create\(|placeOrder\(|submitOrder\(|stakeAmount/);
 assert.match(cockpit,/createOperationsRequestScope/);
 assert.match(cockpit,/if\(!request\.isCurrent\(\)\)return/);
 assert.match(cockpit,/return\(\)=>requestScope\.reset\(\)/);
 assert.match(cockpit,/never places wagers or exchange orders/i);
 assert.match(cockpit,/Manual refresh only/);
 assert.match(cockpit,/up to 50 rows/);
 assert.match(cockpit,/known\?report\.visible:'—'/);
 assert.match(cockpit,/LOADING SNAPSHOT/);
 assert.doesNotMatch(cockpit,/STRICT EDGE BOARD/);
 assert.match(cockpit,/America\/New_York/);
 const page=fs.readFileSync(new URL('../src/app/sports-research/page.tsx',import.meta.url),'utf8');
 assert.match(page,/DailyWeeklyResearchCockpit/);
});
