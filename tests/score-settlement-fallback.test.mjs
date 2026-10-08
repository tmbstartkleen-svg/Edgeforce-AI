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


test('score fallback reports unavailable when durable database is unavailable',async()=>{
 const result=await runtime.finalScoreSettlementRows();
 assert.equal(result.available,false);
 assert.equal(result.rows.length,0);
 assert.match(result.warnings[0],/Database unavailable/);
});

test('score fallback reports available healthy no-op when ledger has no open legs',async()=>{
 const sourceWithDb=readFileSync(new URL('../src/lib/scoreSettlementFallback.ts',import.meta.url),'utf8')
  .replace(/import \{db\} from '.\/db';\n/,'const db=()=>async()=>[];\n')
  .replace(/import \{fetchLiveScoreMesh\} from '.\/liveScoreMesh';\n/,'const fetchLiveScoreMesh=async()=>({games:[]});\n');
 const compiledWithDb=ts.transpileModule(sourceWithDb,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
 assert.equal(compiledWithDb.diagnostics.length,0);
 const rt=await import('data:text/javascript,'+encodeURIComponent(compiledWithDb.outputText));
 const result=await rt.finalScoreSettlementRows();
 assert.equal(result.available,true);
 assert.equal(result.candidateLegs,0);
 assert.equal(result.rows.length,0);
 assert.deepEqual(result.warnings,[]);
});
