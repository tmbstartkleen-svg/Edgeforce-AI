import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
const source=readFileSync(new URL('../src/lib/boardSnapshotCache.ts',import.meta.url),'utf8');
const module=await import('data:text/javascript,'+encodeURIComponent(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText));
test('concurrent board polls perform one build and return independently readable responses',async()=>{
 const snapshot=module.createBoardSnapshotCache();let calls=0,release;
 const gate=new Promise(resolve=>release=resolve);
 const load=async()=>{calls++;await gate;return Response.json({rows:[{id:'market'}]});};
 const a=snapshot('today',load),b=snapshot('today',load);assert.equal(calls,1);release();
 const responses=await Promise.all([a,b]);assert.deepEqual(await responses[0].json(),await responses[1].json());
 const cached=await snapshot('today',load);assert.equal(calls,1);assert.equal((await cached.json()).rows[0].id,'market');assert.ok(cached.headers.has('x-edgeforce-snapshot-age-ms'));
});
test('refresh failure retains a bounded last successful snapshot and reports stored status',async()=>{
 const original=Date.now;let clock=1000;Date.now=()=>clock;
 try{
  const snapshot=module.createBoardSnapshotCache(10,100);await snapshot('today',async()=>Response.json({source:'live',rows:[{id:'first'}],warnings:[],marketCoverage:{qualified:1},topBoardQualification:{qualified:1,forced:false}}));
  clock=1020;const retained=await snapshot('today',async()=>Response.json({error:'timeout'},{status:503}));
  assert.equal(retained.status,200);const data=await retained.json();assert.equal(data.source,'stored');assert.equal(data.marketCoverage.qualified,0);assert.equal(data.topBoardQualification.qualified,0);assert.equal(data.topBoardQualification.forced,true);assert.equal(data.refreshStatus.mode,'STALE_CACHE');assert.equal(data.rows[0].id,'first');assert.match(data.warnings[0],/last successful snapshot/);
  clock=1200;const expired=await snapshot('today',async()=>Response.json({error:'timeout'},{status:503}));assert.equal(expired.status,503);
 }finally{Date.now=original;}
});
test('client and authorization errors are never disguised as successful snapshots',async()=>{
 const snapshot=module.createBoardSnapshotCache(0);await snapshot('key',async()=>Response.json({rows:['old']}));
 const forbidden=await snapshot('key',async()=>Response.json({error:'unauthorized'},{status:401}));assert.equal(forbidden.status,401);
 const rateLimited=await snapshot('key',async()=>Response.json({error:'rate limit'},{status:429,headers:{'Retry-After':'45'}}));assert.equal(rateLimited.status,429);assert.equal(rateLimited.headers.get('Retry-After'),'45');
});
test('failed cold builds are retried and query variants do not share results',async()=>{
 const snapshot=module.createBoardSnapshotCache();let calls=0;
 const failed=async()=>{calls++;return Response.json({error:'failed'},{status:503});};
 await snapshot('today',failed);await snapshot('today',failed);assert.equal(calls,2);
 const today=await snapshot('today',async()=>Response.json({view:'today'}));const week=await snapshot('week',async()=>Response.json({view:'week'}));
 assert.equal((await today.json()).view,'today');assert.equal((await week.json()).view,'week');
});
test('thrown refresh errors retain a snapshot but thrown cold builds remain failures',async()=>{
 const snapshot=module.createBoardSnapshotCache(0);await snapshot('ready',async()=>Response.json({rows:[]}));
 const stale=await snapshot('ready',async()=>{throw Error('upstream');});assert.equal((await stale.json()).refreshStatus.error,'upstream');
 await assert.rejects(snapshot('cold',async()=>{throw Error('unavailable');}),/unavailable/);
});
