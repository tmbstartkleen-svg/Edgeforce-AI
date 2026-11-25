import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const source=fs.readFileSync(new URL('../src/lib/dailyWeeklyResearch.ts',import.meta.url),'utf8');
const js=transpile(source);
const {buildDailyWeeklyResearch,eventSession,isStrictResearchRow,contextForResearchRow}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

const rows=[
 {id:'m1',sport:'NBA',event:'A @ B',selection:'A',market:'spread',startTime:'2026-11-24T15:00:00Z',bucket:'TODAY',grade:'ELITE'},
 {id:'m2',sport:'NFL',event:'C @ D',selection:'D',market:'moneyline',startTime:'2026-11-26T23:00:00Z',bucket:'WEEK',grade:'WATCH'}
];
const changes=[{marketId:'m1',event:'A @ B',selection:'A',sport:'NBA',severity:'ACTION',type:'injury',reason:'starter status changed',detectedAt:'2026-11-24T14:00:00Z'}];

test('daily/week research filters use one supplied snapshot without inventing rows',()=>{
 const today=buildDailyWeeklyResearch(rows,changes,{scope:'today',sport:'ALL',session:'ALL',now:new Date('2026-11-24T12:00:00Z'),qualification:{forced:false,allowedGrades:['ELITE','STRONG']}});
 assert.equal(today.visible,1);
 assert.equal(today.strict,1);
 assert.equal(today.contextFlagged,1);
 assert.equal(today.materialContextFlagged,1);
 const week=buildDailyWeeklyResearch(rows,changes,{scope:'week',sport:'ALL',session:'ALL',qualification:{forced:true,allowedGrades:['ELITE','STRONG']}});
 assert.equal(week.visible,2);
 assert.equal(week.strict,0);
 assert.equal(week.fallback,2);
});

test('session classification and context matching are deterministic',()=>{
 assert.equal(eventSession({...rows[0],period:'AM'}),'AM');
 assert.equal(eventSession({...rows[0],period:'PM'}),'PM');
 assert.equal(contextForResearchRow(rows[0],changes).length,1);
 assert.equal(contextForResearchRow(rows[1],changes).length,0);
 assert.equal(isStrictResearchRow(rows[0],{forced:false,allowedGrades:['ELITE','STRONG']}),true);
 assert.equal(isStrictResearchRow(rows[0],{forced:true,allowedGrades:['ELITE','STRONG']}),false);
});

test('cockpit uses one week snapshot and contains no execution transport',()=>{
 const cockpit=fs.readFileSync(new URL('../src/components/DailyWeeklyResearchCockpit.tsx',import.meta.url),'utf8');
 assert.equal((cockpit.match(/\/api\/live-board\?view=week&limit=50&risk=Moderate/g)||[]).length,1);
 assert.doesNotMatch(cockpit,/\/api\/context-changes|orders\.create\(|placeOrder\(|submitOrder\(|stakeAmount/);
 assert.match(cockpit,/never places wagers or exchange orders/i);
 assert.match(cockpit,/Manual refresh only/);
 const page=fs.readFileSync(new URL('../src/app/sports-research/page.tsx',import.meta.url),'utf8');
 assert.match(page,/DailyWeeklyResearchCockpit/);
});
