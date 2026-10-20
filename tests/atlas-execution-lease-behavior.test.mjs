import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../worker/atlas-execution-lease.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const lease=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const id='schedule-task-001',token='abcdefghijklmnopqrstuvwxyzABCDEF';
test('execution lease requires bounded duration, safe epoch and strong token',()=>{
 assert.throws(()=>lease.createAtlasExecutionLease(id,'weak',1000,10000,0),/INVALID_LEASE_TOKEN/);
 assert.throws(()=>lease.createAtlasExecutionLease(id,token,1000,61000,0),/INVALID_LEASE_WINDOW/);
 assert.throws(()=>lease.createAtlasExecutionLease(id,token,1000,10000,-1),/INVALID_LEASE_EPOCH/);
});
test('lease fences stale executors and expires deterministically',()=>{
 const l=lease.createAtlasExecutionLease(id,token,1000,10000,0);
 assert.equal(l.epoch,1);
 assert.equal(lease.verifyAtlasExecutionLease(l,id,token,1,2000).ok,true);
 assert.equal(lease.verifyAtlasExecutionLease(l,id,'different-token',1,2000).reason,'STALE_EXECUTOR');
 assert.equal(lease.verifyAtlasExecutionLease(l,id,token,2,2000).reason,'STALE_EXECUTOR');
 assert.equal(lease.verifyAtlasExecutionLease(l,id,token,1,11000).reason,'LEASE_EXPIRED');
 assert.equal(lease.verifyAtlasExecutionLease(undefined,id,token,1,2000).reason,'LEASE_REQUIRED');
});
