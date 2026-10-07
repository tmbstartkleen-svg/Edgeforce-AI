import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const ts=createRequire(import.meta.url)('typescript');
const source=readFileSync(new URL('../src/lib/scoreSettlementFallback.ts',import.meta.url),'utf8')
 .replace(/import \{db\} from '.\/db';\n/,'const db=()=>null;\n')
 .replace(/import \{fetchLiveScoreMesh\} from '.\/liveScoreMesh';\n/,'const fetchLiveScoreMesh=async()=>({games:[]});\n');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(compiled.diagnostics.length,0);
const runtime=await import('data:text/javascript,'+encodeURIComponent(compiled.outputText));

test('grades moneyline strictly by exact team selection',()=>{
 assert.equal(runtime.gradeScoreLeg('Moneyline','Home Team','Home Team','Away Team',27,20),'win');
 assert.equal(runtime.gradeScoreLeg('h2h','Away Team','Home Team','Away Team',27,20),'loss');
 assert.equal(runtime.gradeScoreLeg('Moneyline','Other','Home Team','Away Team',27,20),null);
});

test('grades spreads including pushes from stored line',()=>{
 assert.equal(runtime.gradeScoreLeg('spread','Away Team +7','Home Team','Away Team',27,20),'push');
 assert.equal(runtime.gradeScoreLeg('spread','Home Team -6.5','Home Team','Away Team',27,20),'win');
});

test('grades totals including pushes from stored line',()=>{
 assert.equal(runtime.gradeScoreLeg('total','Over 47','Home Team','Away Team',27,20),'push');
 assert.equal(runtime.gradeScoreLeg('total','Under 48','Home Team','Away Team',27,20),'win');
});

test('unsupported or malformed markets fail closed',()=>{
 assert.equal(runtime.gradeScoreLeg('player prop','Player Over 1.5','Home','Away',2,1),null);
 assert.equal(runtime.gradeScoreLeg('spread','Home','Home','Away',2,1),null);
});


test('V150 accepts corroborated final scores and trusted primary single-source finals',()=>{
 const base={status:'FINAL',home:{name:'Home',score:27},away:{name:'Away',score:20}};
 const high=runtime.evaluateFinalScoreSettlementEvidence({
  ...base,source:'espn-cdn',
  consensus:{confidence:'HIGH',sourceCount:3,agreeingSources:2,activeConflict:false,statusConflict:false,scoreConflict:false,laggingSources:[]}
 });
 assert.equal(high.accepted,true);
 assert.equal(high.confidence,'HIGH');
 assert.equal(high.trustedSingleSource,false);

 const trustedSingle=runtime.evaluateFinalScoreSettlementEvidence({
  ...base,source:'mlb-statsapi',
  consensus:{confidence:'SINGLE_SOURCE',sourceCount:1,agreeingSources:1,activeConflict:false,statusConflict:false,scoreConflict:false,laggingSources:[]}
 });
 assert.equal(trustedSingle.accepted,true);
 assert.equal(trustedSingle.trustedSingleSource,true);
});

test('V150 blocks unresolved score conflicts, low confidence, and untrusted single-source finals',()=>{
 const base={status:'FINAL',home:{name:'Home',score:27},away:{name:'Away',score:20}};
 const conflict=runtime.evaluateFinalScoreSettlementEvidence({
  ...base,source:'espn-cdn',
  consensus:{confidence:'MEDIUM',sourceCount:3,agreeingSources:1,activeConflict:true,statusConflict:false,scoreConflict:true,laggingSources:[]}
 });
 assert.equal(conflict.accepted,false);
 assert.match(conflict.reason,/conflict/i);

 const low=runtime.evaluateFinalScoreSettlementEvidence({
  ...base,source:'espn-public',
  consensus:{confidence:'LOW',sourceCount:2,agreeingSources:0,activeConflict:false,statusConflict:false,scoreConflict:true,laggingSources:['thesportsdb']}
 });
 assert.equal(low.accepted,false);
 assert.match(low.reason,/confidence/i);

 const untrusted=runtime.evaluateFinalScoreSettlementEvidence({
  ...base,source:'thesportsdb',
  consensus:{confidence:'SINGLE_SOURCE',sourceCount:1,agreeingSources:1,activeConflict:false,statusConflict:false,scoreConflict:false,laggingSources:[]}
 });
 assert.equal(untrusted.accepted,false);
 assert.match(untrusted.reason,/approved primary provider/i);
});

test('V150 settlement evidence fails closed for non-final or incomplete scores',()=>{
 const live=runtime.evaluateFinalScoreSettlementEvidence({
  status:'LIVE',source:'espn-cdn',home:{name:'Home',score:27},away:{name:'Away',score:20}
 });
 assert.equal(live.accepted,false);
 assert.match(live.reason,/not final/i);

 const incomplete=runtime.evaluateFinalScoreSettlementEvidence({
  status:'FINAL',source:'espn-cdn',home:{name:'Home',score:null},away:{name:'Away',score:20}
 });
 assert.equal(incomplete.accepted,false);
 assert.match(incomplete.reason,/incomplete/i);
});
