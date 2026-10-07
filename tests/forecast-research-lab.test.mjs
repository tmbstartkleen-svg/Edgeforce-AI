import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const ts=createRequire(import.meta.url)('typescript');
const transpile=(source)=>ts.transpileModule(source,{
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
 reportDiagnostics:true
});

const settlementSource=readFileSync(new URL('../src/lib/settlementLearning.ts',import.meta.url),'utf8');
const settlementCompiled=transpile(settlementSource);
assert.equal(settlementCompiled.diagnostics.length,0);
const settlementUrl='data:text/javascript,'+encodeURIComponent(settlementCompiled.outputText);

const researchSource=readFileSync(new URL('../src/lib/forecastResearchLab.ts',import.meta.url),'utf8')
 .replace("from './settlementLearning'","from '"+settlementUrl+"'");
const researchCompiled=transpile(researchSource);
assert.equal(researchCompiled.diagnostics.length,0);
const runtime=await import('data:text/javascript,'+encodeURIComponent(researchCompiled.outputText));

const provider={settlementLearning:{
 schemaVersion:'v152-settlement-learning-1',evidenceClass:'PROVIDER_NATIVE',confidence:'PROVIDER_NATIVE',
 trainingEligible:true,evidenceWeight:1,legacy:false,reason:'fixture'
}};
const medium={settlementLearning:{
 schemaVersion:'v152-settlement-learning-1',evidenceClass:'CORROBORATED_SCORE',confidence:'MEDIUM',
 trainingEligible:true,evidenceWeight:.75,legacy:false,reason:'fixture'
}};

const row=(i,p,outcome,features=provider,modelName='Research Model')=>({
 occurredAt:new Date(Date.UTC(2026,9,1,0,i)).toISOString(),
 sport:'TEST',marketKey:'Outcome',modelName,modelVersion:'test',selectionKey:'s'+i,
 predicted:p,odds:0,outcome,features
});

test('V155 forecast metrics use settlement evidence weights without monetary outputs',()=>{
 const rows=[row(1,.8,1),row(2,.7,1,medium),row(3,.3,0),row(4,.6,0,medium)];
 const metrics=runtime.forecastResearchMetrics(rows);
 assert.equal(metrics.sampleSize,4);
 assert.equal(metrics.effectiveSampleSize,3.5);
 assert.ok(metrics.brierScore>0&&metrics.brierScore<1);
 assert.ok(metrics.logLoss>0);
 assert.ok(metrics.sharpness>=0&&metrics.sharpness<=1);
 assert.ok(!('roi' in metrics));
 assert.ok(!('avgEv' in metrics));
 assert.ok(!('stake' in metrics));
});

test('V155 reliability bands expose weighted observed-vs-forecast calibration',()=>{
 const rows=[
  row(1,.82,1),row(2,.78,1,medium),row(3,.22,0),row(4,.18,0,medium)
 ];
 const bands=runtime.forecastReliabilityBands(rows,5);
 assert.equal(bands.length,5);
 assert.equal(bands.reduce((s,b)=>s+b.sampleSize,0),4);
 assert.equal(bands.reduce((s,b)=>s+b.effectiveSampleSize,0),3.5);
 assert.ok(bands.some(b=>b.direction==='CALIBRATED'||b.direction==='OVERCONFIDENT'||b.direction==='UNDERCONFIDENT'));
});

test('V155 fingerprint is deterministic regardless of input order',()=>{
 const rows=[row(1,.7,1),row(2,.4,0),row(3,.6,1,medium)];
 const a=runtime.forecastResearchFingerprint(rows);
 const b=runtime.forecastResearchFingerprint([...rows].reverse());
 assert.equal(a,b);
 assert.match(a,/^frl-[0-9a-f]{8}-3$/);
});

test('V155 temporal replay detects a meaningful recent degradation',()=>{
 const rows=[];
 for(let i=0;i<60;i++)rows.push(row(i,i%2===0?.8:.2,i%2===0?1:0,provider,'Replay Model'));
 for(let i=60;i<80;i++)rows.push(row(i,i%2===0?.9:.1,i%2===0?0:1,provider,'Replay Model'));
 const replay=runtime.forecastTemporalReplay(rows,.25);
 assert.equal(replay.state,'DRIFTING');
 assert.ok(replay.brierDelta>.2);
});

test('V155 research report stays research-only and builds model scorecards',()=>{
 const rows=[];
 for(let i=0;i<40;i++)rows.push(row(i,i%2===0?.72:.28,i%2===0?1:0,provider,'Model A'));
 for(let i=40;i<80;i++)rows.push(row(i,i%2===0?.62:.38,i%3===0?1:0,provider,'Model B'));
 const report=runtime.buildForecastResearchReport(rows);
 assert.equal(report.researchOnly,true);
 assert.equal(report.scorecards.length,2);
 assert.equal(report.reliability.length,10);
 assert.ok(report.fingerprint.startsWith('frl-'));
 assert.ok(!('stake' in report));
 assert.ok(!('order' in report));
 assert.ok(!('wager' in report));
});
