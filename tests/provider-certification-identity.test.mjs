import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const ts=createRequire(import.meta.url)('typescript');
const providerSource=readFileSync(new URL('../src/lib/providerCertification.ts',import.meta.url),'utf8')
 .replace(/^import .*;\n/gm,'');
const compiled=ts.transpileModule(providerSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(compiled.diagnostics.length,0);
const runtime=await import('data:text/javascript,'+encodeURIComponent(compiled.outputText));
const doctorSource=readFileSync(new URL('../src/app/api/launch-doctor/route.ts',import.meta.url),'utf8');
const routeSource=readFileSync(new URL('../src/app/api/providers/certify/route.ts',import.meta.url),'utf8');

test('runtime certification identity prefers explicit deployment commit',()=>{
 assert.equal(runtime.providerCertificationRuntimeCommit({
  DEPLOYMENT_COMMIT:'deploy-sha',
  VERCEL_GIT_COMMIT_SHA:'vercel-sha',
  GITHUB_SHA:'github-sha'
 }),'deploy-sha');
 assert.equal(runtime.providerCertificationRuntimeCommit({
  VERCEL_GIT_COMMIT_SHA:'vercel-sha',
  GITHUB_SHA:'github-sha'
 }),'vercel-sha');
});

test('certification commit marker is persisted internally but hidden from visible warnings',()=>{
 const marker=runtime.providerCertificationCommitMarker('abc123');
 assert.equal(marker,'__edgeforce_deployment_commit__:abc123');
 const warnings=['weather missing',marker];
 assert.equal(runtime.extractProviderCertificationCommit(warnings),'abc123');
 assert.deepEqual(runtime.visibleProviderCertificationWarnings(warnings),['weather missing']);
});

test('latest certification query filters by exact commit marker',()=>{
 assert.match(providerSource,/where warnings @> \$\{sql\.json\(\[marker\]\)\}/);
 assert.match(providerSource,/deploymentCommit:deploymentCommit\|\|undefined/);
});

test('certification API scopes GET to current runtime identity',()=>{
 assert.match(routeSource,/providerCertificationRuntimeCommit\(\)/);
 assert.match(routeSource,/latestProviderCertification\(deploymentCommit\|\|undefined\)/);
});

test('launch doctor requires exact certification deployment identity',()=>{
 assert.match(doctorSource,/latestProviderCertification\(deploymentCommit\|\|undefined\)/);
 assert.match(doctorSource,/provider certification deployment identity mismatch/);
 assert.match(doctorSource,/certificationIdentity:/);
});


test('persisted certification restores deployment identity and hides internal marker warnings',()=>{
 assert.match(providerSource,/deploymentCommit:deploymentCommit\|\|undefined/);
 assert.match(providerSource,/extractProviderCertificationCommit\(row\.warnings\)/);
 assert.match(providerSource,/warnings:visibleProviderCertificationWarnings\(row\.warnings\)/);
});
