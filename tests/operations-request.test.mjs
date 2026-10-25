import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperationsRequestScope,readOperationsResponse} from '../src/lib/operations-request.mjs';
test('lock invalidates an in-flight result even when transport ignores abort',()=>{
 const scope=createOperationsRequestScope();const pending=scope.begin();scope.reset();
 assert.equal(pending.signal.aborted,true);assert.equal(pending.isCurrent(),false);pending.finish();
});
test('only newest response can update a panel',()=>{
 const scope=createOperationsRequestScope();const old=scope.begin();const current=scope.begin();
 assert.equal(old.isCurrent(),false);assert.equal(current.isCurrent(),true);assert.equal(old.signal.aborted,true);scope.reset();
});
test('timeout aborts request but leaves it current for a visible error',async()=>{
 const scope=createOperationsRequestScope();const request=scope.begin(5);
 await new Promise(resolve=>request.signal.addEventListener('abort',resolve,{once:true}));
 assert.equal(request.isCurrent(),true);scope.reset();
});
test('recognizes authentication, quota and service errors without parsing HTML',async()=>{
 for(const [status,message] of [[401,/token was not accepted/],[429,/limit reached/],[503,/temporarily unavailable/]]){
  await assert.rejects(readOperationsResponse(new Response('<html>private diagnostic</html>',{status})),message);
 }
});
test('invalid JSON and unsuccessful payloads fail closed',async()=>{
 await assert.rejects(readOperationsResponse(new Response('<html>proxy</html>')),/unexpected response/);
 await assert.rejects(readOperationsResponse(Response.json({ok:false,error:'internal details'})),/data is unavailable/);
 assert.deepEqual(await readOperationsResponse(Response.json({ok:true,summary:{total:0}})),{ok:true,summary:{total:0}});
});
