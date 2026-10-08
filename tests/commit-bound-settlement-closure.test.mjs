import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const automation=read('src/lib/automationHealth.ts');
const closure=read('src/lib/finalProductionClosure.ts');
const workflow=read('.github/workflows/deploy-cloudflare.yml');

test('V173 automation evidence is bound to deployed runtime identity',()=>{
 assert.match(automation,/deploymentCommit:String\(process\.env\.DEPLOYMENT_COMMIT\|\|process\.env\.VERCEL_GIT_COMMIT_SHA\|\|''\)/);
 assert.match(automation,/deploymentPlatform:String\(/);
 assert.match(automation,/deploymentEnv:String\(/);
 assert.match(automation,/metadata->>'deploymentCommit'=\$\{commit\}/);
});

test('V173 final closure requires successful settlement for the exact candidate commit',()=>{
 assert.match(closure,/latestAutomationRunForCommit\('settle',commitSha\)/);
 assert.match(closure,/String\(settlementMetadata\?\.deploymentCommit\|\|''\)===commitSha/);
 assert.match(closure,/settlementRun\.status==='success'/);
 assert.match(closure,/settlementResult\?\.ok===true/);
 assert.match(closure,/fresh successful settlement automation evidence is missing or uncertified for the candidate commit/);
});

test('V173 score fallback settlement must be evidence-certified before closure',()=>{
 assert.match(closure,/const settlementFallbackUsed=String\(settlementResult\?\.mode\|\|''\)\.includes\('score-fallback'\)/);
 assert.match(closure,/!settlementFallbackUsed\|\|settlementResult\?\.fallbackEvidenceCertified===true/);
 assert.match(closure,/settlementFallbackEvidenceCertified:settlementFallbackUsed\?Boolean\(settlementResult\?\.fallbackEvidenceCertified\):null/);
});

test('V173 closure evidence records settlement mode and identity telemetry',()=>{
 assert.match(closure,/settlementCertified,/);
 assert.match(closure,/settlementRunStartedAt:/);
 assert.match(closure,/settlementMode:settlementResult\?\.mode\|\|null/);
 assert.match(closure,/settlementNoop:Boolean\(settlementResult\?\.settlementNoop\)/);
 assert.match(closure,/settlementIdentityMatches:settlementResult\?\.settlementIdentityMatches\|\|null/);
});

test('V173 production workflow primes settlement before final closure',()=>{
 const prime=workflow.indexOf('Prime settlement automation health');
 const close=workflow.indexOf('Attempt final production closure');
 assert.ok(prime>=0);
 assert.ok(close>prime);
});
