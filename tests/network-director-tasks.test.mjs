import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const room=read('worker/atlas-mission-room.ts');
const gateway=read('worker/atlas-mission-gateway.ts');
const worker=read('worker/index.ts');
const ui=read('src/components/NetworkCommand.tsx');

test('Build 409 records durable task starts and terminal outcomes atomically',()=>{
 assert.match(room,/export type DirectorTask=/);
 assert.match(room,/MAX_DIRECTOR_TASKS=120/);
 assert.match(room,/url\.pathname==='\/tasks\/start'/);
 assert.match(room,/url\.pathname==='\/tasks\/finish'/);
 assert.match(room,/state\.storage\.transaction/);
 assert.match(room,/old\[idx\]\.status!=='RUNNING'/);
 assert.match(room,/slice\(-MAX_DIRECTOR_TASKS\)/);
 assert.match(room,/previous|old\.some\(item=>item\.id===id\)/);
});

test('Gateway requires Founder auth and journals task creation before AI calls',()=>{
 assert.match(gateway,/isTasks=url\.pathname==='\/api\/network\/tasks'/);
 assert.match(worker,/pathname==='\/api\/network\/tasks'/);
 assert.match(gateway,/await validToken\(required,supplied\)/);
 assert.match(gateway,/roomRequest\('\/tasks\/start','POST'/);
 assert.match(gateway,/roomRequest\('\/tasks\/finish','POST'/);
 assert.ok(gateway.indexOf("roomRequest('/tasks/start'")<gateway.indexOf('await forward(request)'));
 assert.match(gateway,/if\(!await finishTask\('COMPLETED'/);
 assert.match(gateway,/await finishTask\('FAILED'/);
 assert.match(gateway,/MISSION_PERSISTENCE_FAILED/);
 assert.match(gateway,/DIRECTOR_TASK_FINALIZATION_FAILED/);
});

test('Director reports retain source limitations without granting agent autonomy',()=>{
 assert.match(room,/VALID_DIRECTORS/);
 assert.match(room,/executionMode:'request-scoped'/);
 assert.match(room,/status:'INTERRUPTED' as const/);
 assert.match(gateway,/evidence:Array\.isArray\(item\.sources\)/);
 assert.match(gateway,/limitations:Array\.isArray\(item\.limitations\)/);
 assert.doesNotMatch(gateway,/PLACE_BET|wager\(/);
});

test('Founder room provides private agent filters, task status and refresh',()=>{
 assert.match(ui,/Director Task Board/);
 assert.match(ui,/\/api\/network\/tasks/);
 assert.match(ui,/type DirectorTask/);
 assert.match(ui,/Refresh activity/);
 assert.match(ui,/taskAgent==='all'\|\|item\.agent===taskAgent/);
 assert.match(ui,/networkTaskStatus/);
 assert.match(ui,/ATLAS <span>Command Center/);
 assert.doesNotMatch(ui,/localStorage/);
});
