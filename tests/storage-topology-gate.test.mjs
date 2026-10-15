import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const run=primary=>spawnSync(process.execPath,['scripts/storage-topology-gate.mjs'],{
 encoding:'utf8',env:{...process.env,EDGEFORCE_PRIMARY_STORAGE:primary}
});
test('existing postgres runtime is unaffected by secondary Neon planning',()=>{
 const x=run('postgres');assert.equal(x.status,0,x.stderr);
 const result=JSON.parse(x.stdout);assert.equal(result.safeToPromote,true);
 assert.equal(result.postgresRuntime,true);assert.equal(result.d1Bound,true);
});
test('uncertified D1 primary cutover is rejected rather than silently losing tables',()=>{
 const x=run('d1');assert.notEqual(x.status,0);
 const result=JSON.parse(x.stderr);assert.equal(result.d1FullApplicationReady,false);
 assert.equal(result.neonRoleRequested,'secondary');
});
test('unknown storage configuration is rejected',()=>{
 const x=run('memory');assert.notEqual(x.status,0);
 assert.match(x.stderr,/UNKNOWN_PRIMARY_STORAGE/);
});
