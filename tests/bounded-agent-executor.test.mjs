import test from 'node:test';
import assert from 'node:assert/strict';
import {claimDueTask,finishTask} from '../src/lib/intelligence-core/bounded-agent-executor.mjs';
test('empty task queue yields no claim',async()=>{
 const db={prepare(sql){return {bind(){return this},async first(){return null}}}};
 assert.equal(await claimDueTask(db,{workerId:'worker-1'}),null);
});
test('reject invalid worker and task identifiers',async()=>{
 const db={prepare(){throw Error('unexpected query')}};
 await assert.rejects(claimDueTask(db,{workerId:'bad worker'}),/INVALID_WORKER_ID/);
 await assert.rejects(finishTask(db,{taskId:'bad id',success:true}),/INVALID_TASK_ID/);
});
test('successful claim uses compare-and-swap and logs audit event',async()=>{
 const calls=[];
 const db={prepare(sql){calls.push(sql);return {bind(...args){this.args=args;return this},
 async first(){return {task_id:'a',agent_id:'sport-nfl',division:'SPORTS',source_id:'s',task_kind:'COLLECT_SCORE',attempts:0,max_attempts:3}},
 async run(){return {meta:{changes:1}}}}}};
 const task=await claimDueTask(db,{workerId:'worker-1'});
 assert.equal(task.task_state,'RUNNING');
 assert.equal(task.attempts,1);
 assert.ok(calls.some(s=>s.includes("task_state='PENDING' AND attempts=?")));
 assert.ok(calls.some(s=>s.includes('specialist_task_events')));
});
test('no audit success if task is not in RUNNING state',async()=>{
 const db={prepare(){return {bind(){return this},async run(){return {meta:{changes:0}}}}}};
 assert.equal(await finishTask(db,{taskId:'task-1',success:true}),false);
});
