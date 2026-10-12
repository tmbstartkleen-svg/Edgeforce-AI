import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateTaskRecord,assertTaskTransition} from '../src/lib/intelligence-core/agent-task-ledger.mjs';
test('sport tasks and non-sports prediction tasks stay isolated',()=>{
 const a=validateTaskRecord({taskId:'nfl:1',agentId:'sport-nfl',division:'SPORTS',sourceId:'upstream',taskKind:'COLLECT_SCORE'});
 const b=validateTaskRecord({taskId:'economy:1',agentId:'prediction-economics',division:'PREDICTION_MARKETS',sourceId:'upstream',taskKind:'COLLECT_CONTRACT'});
 assert.equal(a.division,'SPORTS');assert.equal(b.division,'PREDICTION_MARKETS');
 assert.throws(()=>validateTaskRecord({...b,division:'SPORTS'}),/DIVISION_MISMATCH/);
});
test('terminal task states cannot silently restart',()=>{
 assert.ok(assertTaskTransition('PENDING','RUNNING'));
 assert.ok(assertTaskTransition('RUNNING','FAILED'));
 assert.throws(()=>assertTaskTransition('SUCCEEDED','RUNNING'),/INVALID_TASK_TRANSITION/);
});
test('D1 migration is additive and task attempts bounded',()=>{
 const sql=fs.readFileSync('db/d1/0002_agent_tasks.sql','utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS specialist_tasks/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS specialist_task_events/);
 assert.doesNotMatch(sql,/\bDROP\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/i);
 assert.throws(()=>validateTaskRecord({taskId:'a',agentId:'sport-nfl',division:'SPORTS',sourceId:'a',taskKind:'SCAN',maxAttempts:100}),/INVALID_ATTEMPT_LIMIT/);
});
