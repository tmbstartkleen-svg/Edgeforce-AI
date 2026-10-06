import test from 'node:test';
import assert from 'node:assert/strict';
import {createSmokeFetch,parseCurlResponse} from '../scripts/smoke-transport.mjs';

const frame=(body,status=200)=>body+'\nEDGEFORCE_SMOKE_HTTP_STATUS:'+status;
const transportError=status=>Object.assign(new Error('sensitive CLI diagnostics'),{status,stderr:'private-bypass-token',stdout:'private-response'});
const options={base:'https://candidate.example',vercelAuth:true,sleep:async()=>{},onRetry:()=>{}};

test('connection reset retries the same GET and retains its actual response',async()=>{
 let calls=0;
 const retries=[];
 const read=createSmokeFetch({...options,onRetry:event=>retries.push(event),run:(command,args,settings)=>{
  assert.equal(command,'vercel');
  assert.equal(args[0],'curl');
  assert.equal(args[1],options.base+'/api/intelligence/ml-tournament');
  assert.ok(args.includes('--max-time'));
  assert.equal(settings.timeout,45000);
  assert.deepEqual(settings.stdio,['ignore','pipe','pipe']);
  if(++calls===1)throw transportError(35);
  return frame('{"ok":true}');
 }});
 const response=await read('/api/intelligence/ml-tournament');
 assert.equal(calls,2);
 assert.equal(response.attempts,2);
 assert.equal(response.status,200);
 assert.equal(await response.text(),'{"ok":true}');
 assert.deepEqual(retries,[{path:'/api/intelligence/ml-tournament',attempt:1,code:35}]);
});

test('persistent reset fails after exactly three attempts without leaking diagnostics',async()=>{
 let calls=0;
 const read=createSmokeFetch({...options,run:()=>{calls++;throw transportError(35);}});
 await assert.rejects(read('/api/health'),error=>{
  assert.match(error.message,/exhausted retries after 3/);
  assert.doesNotMatch(error.stack,/private-|sensitive/);
  return true;
 });
 assert.equal(calls,3);
});

test('authentication, redirects, certificate errors and HTTP failures are not retried',async()=>{
 for(const status of [302,401,403,404,429,500,503]){
  let calls=0;
  const response=await createSmokeFetch({...options,run:()=>{calls++;return frame('{"ok":false}',status);}})('/api/health');
  assert.equal(response.status,status);
  assert.equal(response.ok,false);
  assert.equal(calls,1);
 }
 for(const status of [1,2,22,60]){
  let calls=0;
  await assert.rejects(createSmokeFetch({...options,run:()=>{calls++;throw transportError(status);}})('/api/health'),/non-retryable/);
  assert.equal(calls,1);
 }
});

test('missing or malformed HTTP status fails closed without retry',async()=>{
 for(const output of ['{"ok":true}','{}\nEDGEFORCE_SMOKE_HTTP_STATUS:000','{}\nEDGEFORCE_SMOKE_HTTP_STATUS:200junk']){
  let calls=0;
  await assert.rejects(createSmokeFetch({...options,run:()=>{calls++;return output;}})('/api/health'),/non-retryable/);
  assert.equal(calls,1);
 }
});

test('invalid JSON and CLI noise remain visible to the caller contract validator',async()=>{
 let calls=0;
 const response=await createSmokeFetch({...options,run:()=>{calls++;return frame('Vercel CLI noise\n{"ok":true}');}})('/api/health');
 const body=await response.text();
 assert.throws(()=>JSON.parse(body));
 assert.equal(body,'Vercel CLI noise\n{"ok":true}');
 assert.equal(calls,1);
});

test('intentional degraded response preserves both status and schema',async()=>{
 const body=JSON.stringify({ok:false,degraded:true,schemaVersion:'v51-prediction-validation-1'});
 const response=await createSmokeFetch({...options,run:()=>frame(body,503)})('/api/parlays?size=2&view=today');
 assert.equal(response.status,503);
 assert.equal(response.ok,false);
 assert.deepEqual(JSON.parse(await response.text()),JSON.parse(body));
});

test('native fetch retries mid-body reset and uses manual redirects with a deadline',async()=>{
 let calls=0;
 const read=createSmokeFetch({...options,vercelAuth:false,fetchImpl:async(url,settings)=>{
  assert.equal(url,'https://candidate.example/api/health');
  assert.equal(settings.redirect,'manual');
  assert.ok(settings.signal instanceof AbortSignal);
  calls++;
  return {ok:true,status:200,text:async()=>{
   if(calls===1)throw Object.assign(new Error('terminated'),{cause:{code:'ECONNRESET'}});
   return '{"ok":true}';
  }};
 }});
 assert.equal((await read('/api/health')).attempts,2);
 assert.equal(calls,2);
});

test('native fetch does not retry invalid TLS certificates or HTTP errors',async()=>{
 let calls=0;
 const read=createSmokeFetch({...options,vercelAuth:false,fetchImpl:async()=>{
  calls++;
  throw Object.assign(new TypeError('fetch failed'),{cause:{code:'CERT_HAS_EXPIRED'}});
 }});
 await assert.rejects(read('/api/health'),/non-retryable/);
 assert.equal(calls,1);
 const response=await createSmokeFetch({...options,vercelAuth:false,fetchImpl:async()=>({ok:false,status:503,text:async()=>'unavailable'})})('/api/health');
 assert.equal(response.status,503);
 assert.equal(response.attempts,1);
});

test('native timeouts are bounded and status parsing preserves body newlines',async()=>{
 let calls=0;
 await assert.rejects(createSmokeFetch({...options,vercelAuth:false,fetchImpl:async()=>{
  calls++;
  throw Object.assign(new Error('timeout'),{name:'TimeoutError'});
 }})('/api/health'),/after 3 attempt/);
 assert.equal(calls,3);
 assert.equal(await parseCurlResponse(frame('a\nb\n')).text(),'a\nb\n');
});

test('untrusted origins and cross-host paths are rejected',async()=>{
 assert.throws(()=>createSmokeFetch({...options,base:'file:///tmp/test'}),/Invalid smoke base/);
 assert.throws(()=>createSmokeFetch({...options,base:'https://user:password@example.com'}),/Invalid smoke base/);
 await assert.rejects(createSmokeFetch(options)('//other.example/api/health'),/Smoke path/);
});
