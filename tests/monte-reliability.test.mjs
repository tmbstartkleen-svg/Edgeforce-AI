import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const calibration=transpile(readFileSync(new URL('../src/lib/calibration.ts',import.meta.url),'utf8'));
const calibrationUrl='data:text/javascript;base64,'+Buffer.from(calibration).toString('base64');
const reliabilityTs=readFileSync(new URL('../src/lib/monteReliability.ts',import.meta.url),'utf8');
const reliabilityJs=transpile(reliabilityTs).replace(/from ['"]\.\/calibration['"]/g,"from '"+calibrationUrl+"'");
const {buildReliabilityReport,buildChronologicalReliabilityReport}=await import(
 'data:text/javascript;base64,'+Buffer.from(reliabilityJs).toString('base64')
);

test('reliability report validates probabilities and bins probability 1 in the final bucket',()=>{
 const report=buildReliabilityReport([
  {predicted:0,outcome:0},{predicted:.25,outcome:0},{predicted:.75,outcome:1},{predicted:1,outcome:1}
 ],10);
 assert.equal(report.sampleSize,4);
 assert.equal(report.bins[9].count,1);
 assert.ok(report.brierScore!==null);
 assert.throws(()=>buildReliabilityReport([{predicted:1.1,outcome:1}],10),/Predictions must be finite/);
});

test('chronological OOS gate requires training cutoff before forecast before settlement',()=>{
 const points=Array.from({length:200},(_,i)=>({
  predicted:i%2?.65:.35,
  outcome:i%2?1:0,
  gameId:'game-'+(i%50),
  modelTrainedThrough:'2026-01-01T00:00:00Z',
  forecastAt:'2026-01-02T00:00:00Z',
  settledAt:'2026-01-03T00:00:00Z'
 }));
 const report=buildChronologicalReliabilityReport(points);
 assert.equal(report.status,'review_required');
 assert.equal(report.sampleSize,200);
 assert.equal(report.distinctGames,50);
 assert.equal(report.chronologicalPoints,200);
 assert.deepEqual(report.reasons,[]);
});

test('chronological OOS gate blocks leakage, missing identity and insufficient evidence',()=>{
 const bad=[
  {predicted:.6,outcome:1,gameId:'',modelTrainedThrough:'2026-01-01T00:00:00Z',forecastAt:'2026-01-02T00:00:00Z',settledAt:'2026-01-03T00:00:00Z'},
  {predicted:.4,outcome:0,gameId:'g2',modelTrainedThrough:'2026-01-03T00:00:00Z',forecastAt:'2026-01-02T00:00:00Z',settledAt:'2026-01-04T00:00:00Z'}
 ];
 const report=buildChronologicalReliabilityReport(bad);
 assert.equal(report.status,'blocked');
 assert.ok(report.reasons.includes('missing_game_identity'));
 assert.ok(report.reasons.includes('chronology_or_leakage_violation'));
 assert.ok(report.reasons.includes('insufficient_out_of_sample_predictions'));
 assert.ok(report.reasons.includes('insufficient_distinct_games'));
});

test('Monte reliability remains diagnostic and never auto-approves betting or execution',()=>{
 const source=readFileSync(new URL('../src/lib/monteReliability.ts',import.meta.url),'utf8');
 assert.match(source,/status: 'blocked' \| 'review_required'/);
 assert.match(source,/never authorizes wagering or live execution/i);
 assert.doesNotMatch(source,/status:\s*['"]approved['"]|eligibleForVerifiedAlert:\s*true|orders\.create\(|placeOrder\(/);
});
