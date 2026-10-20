import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const room=fs.readFileSync(new URL('../worker/atlas-mission-room.ts',import.meta.url),'utf8');
const gateway=fs.readFileSync(new URL('../worker/atlas-mission-gateway.ts',import.meta.url),'utf8');
test('durable scheduler helpers connected only to private mission room',()=>{
 assert.match(room,/import \{enqueueAtlasSchedule\}/);
 assert.match(room,/import \{transitionAtlasSchedule\}/);
 assert.match(room,/url.hostname!=='atlas.internal'/);
 assert.match(room,/executionMode:'disabled'/);
 assert.match(room,/error:'SCHEDULER_DISABLED'/);
 assert.match(gateway,/isScheduleStatus=url.pathname===/);
 assert.match(gateway,/isScheduleStatus\)\{/);
 assert.match(gateway,/request.method!=='GET'/);
 assert.doesNotMatch(gateway,/\/api\/network\/schedule\/enqueue|\/api\/network\/schedule\/claim|\/api\/network\/schedule\/complete/);
});

test('scheduler health never claims readiness without an executor',()=>{
 assert.match(room,/ready:false,executionMode:'disabled'/);
 assert.match(room,/executorConnected:false,cronConnected:false,liveDispatchVerified:false/);
 assert.match(room,/NO_LIVE_DISPATCH_CERTIFICATION/);
});

test('owner-only cancellation is routed while execution remains disabled',()=>{
 assert.match(gateway,/isScheduleCancel=url.pathname===/);
 assert.match(gateway,/if\(!await validToken\(required,supplied\)\)/);
 assert.match(gateway,/roomRequest\('\/schedule\/cancel','POST'/);
 assert.match(room,/cancelAtlasLeasedExecution\(this.state.storage/);
 assert.match(room,/ownerAuthorized:true/);
 assert.match(gateway,/if\(isScheduleLifecycle\)return json\(\{ok:false,error:'SCHEDULER_DISABLED'\}/);
});

test('scheduler mutation remains blocked despite caller-supplied activation fields',()=>{
 const lifecyclePos=gateway.indexOf("if(isScheduleLifecycle)return json({ok:false,error:'SCHEDULER_DISABLED'},403)");
 const authPos=gateway.indexOf("if(!await validToken(required,supplied))");
 assert.ok(authPos>=0&&lifecyclePos>authPos,'Lifecycle rejection must follow authentication');
 assert.match(room,/if\(url.pathname.startsWith\('\/schedule\/'\)&&request.method!=='GET'\)/);
 assert.doesNotMatch(gateway,/roomRequest\('\/schedule\/(claim|complete|enqueue)'/);
});

test('owner-authenticated task inspection is read-only and excludes lease records',()=>{
 assert.match(gateway,/isScheduleTask=url.pathname===/);
 assert.match(gateway,/roomRequest\('\/schedule\/task\?id='/);
 assert.match(room,/url.pathname==='\/schedule\/task'&&request.method==='GET'/);
 assert.match(room,/this.state.storage.get<import\('\.\/atlas-task-scheduling'\).AtlasScheduleRecord>/);
 assert.doesNotMatch(room,/return json\(\{ok:true,task,lease\}/);
});
