import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const ts=createRequire(import.meta.url)('typescript');
const source=readFileSync(new URL('../src/lib/finalClosureChain.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(compiled.diagnostics.length,0);
const runtime=await import('data:text/javascript,'+encodeURIComponent(compiled.outputText));

const report=(workflowRunId,closed=true)=>({
 releaseVersion:'119.0.0',
 modelVersion:'edgeforce-v119',
 migrationVersion:118,
 commitSha:'abc1234def5678',
 closed,
 blockers:closed?[]:['blocked'],
 evidence:{settlementCertified:true,settlementIdentityCoverage:1},
 source:'production-cloudflare',
 workflowRunId
});

test('V179 appends hash-linked closure certificates across same-commit attempts',async()=>{
 const first=await runtime.appendClosureCertificate({},report('run-1'),'2026-10-08T13:00:00.000Z');
 assert.equal(first.count,1);
 assert.equal(first.chain[0].sequence,1);
 assert.equal(first.chain[0].previousHash,null);
 assert.match(first.head,/^[a-f0-9]{64}$/);

 const second=await runtime.appendClosureCertificate(first.evidence,report('run-2'),'2026-10-08T13:05:00.000Z');
 assert.equal(second.count,2);
 assert.equal(second.chain[1].sequence,2);
 assert.equal(second.chain[1].previousHash,first.head);
 assert.notEqual(second.head,first.head);

 const verified=await runtime.verifyClosureEvidenceChain(second.evidence);
 assert.equal(verified.valid,true);
 assert.equal(verified.count,2);
 assert.equal(verified.head,second.head);
});

test('V179 detects certificate payload tampering',async()=>{
 const first=await runtime.appendClosureCertificate({},report('run-1'),'2026-10-08T13:00:00.000Z');
 const second=await runtime.appendClosureCertificate(first.evidence,report('run-2'),'2026-10-08T13:05:00.000Z');
 const tampered=structuredClone(second.evidence);
 tampered.certificateChain[0].certificate.closed=false;
 const verified=await runtime.verifyClosureEvidenceChain(tampered);
 assert.equal(verified.valid,false);
 assert.match(String(verified.error),/hash mismatch/);
});

test('V179 detects chain metadata tampering',async()=>{
 const first=await runtime.appendClosureCertificate({},report('run-1'),'2026-10-08T13:00:00.000Z');
 const tampered=structuredClone(first.evidence);
 tampered.certificateHead='0'.repeat(64);
 const verified=await runtime.verifyClosureEvidenceChain(tampered);
 assert.equal(verified.valid,false);
 assert.match(String(verified.error),/metadata mismatch/);
});

test('V179 canonical serializer is independent of object key order',()=>{
 assert.equal(
  runtime.stableClosureStringify({b:2,a:{d:4,c:3}}),
  runtime.stableClosureStringify({a:{c:3,d:4},b:2})
 );
});
