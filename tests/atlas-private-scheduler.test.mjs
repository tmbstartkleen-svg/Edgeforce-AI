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
