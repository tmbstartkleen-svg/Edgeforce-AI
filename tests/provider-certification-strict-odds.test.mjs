import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const ts=createRequire(import.meta.url)('typescript');
const source=readFileSync(new URL('../src/lib/providerCertification.ts',import.meta.url),'utf8')
 .replace(/^import .*;\n/gm,'');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(compiled.diagnostics.length,0);
const runtime=await import('data:text/javascript,'+encodeURIComponent(compiled.outputText));

const row=(overrides={})=>({
 providerId:'p',providerName:'Provider',capability:'ODDS',status:'CAUTION',priority:1,latencyMs:1,
 rowCount:10,normalizedCount:0,freshnessScore:1,qualityScore:.78,qualityGrade:'CAUTION',
 authConfigured:false,maxAgeMin:2,reasons:[],...overrides
});

test('pulse-only caution does not satisfy strict ODDS launch gate',()=>{
 const result=runtime.evaluateCertificationResults([row()]);
 assert.equal(result.launchReady,false);
 assert.ok(result.blockers.includes('ODDS: no certified provider available'));
 assert.equal(result.coverage.find(x=>x.capability==='ODDS').status,'PARTIAL');
});

test('a certified normalized ODDS source satisfies the launch gate',()=>{
 const result=runtime.evaluateCertificationResults([
  row(),
  row({providerId:'espn-core-odds',providerName:'ESPN Core Odds',status:'CERTIFIED',normalizedCount:12,qualityGrade:'USABLE'})
 ]);
 assert.equal(result.launchReady,true);
 assert.equal(result.coverage.find(x=>x.capability==='ODDS').status,'READY');
});

test('FanDuel pulse is explicitly continuity-only in certification source',()=>{
 assert.match(source,/providerId:'fanlinewire-fanduel-pulse'/);
 assert.match(source,/status:pulseAcceptable\?'CAUTION':'FAILED'/);
 assert.match(source,/normalizedCount:0/);
 assert.match(source,/cannot satisfy the strict normalized ODDS launch requirement/);
});
