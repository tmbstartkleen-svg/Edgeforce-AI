import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync('db/d1/0006_score_scheduler_receipts.sql','utf8');
const worker=readFileSync('worker/d1-standalone.ts','utf8');
test('scheduler receipt schema is additive, constrained, and indexed',()=>{
 assert.match(sql,/CREATE TABLE IF NOT EXISTS score_scheduler_receipts/);
 assert.match(sql,/PRIMARY KEY \(run_id, sport\)/);
 assert.match(sql,/CHECK \(persisted IN \(0,1\)\)/);
 assert.match(sql,/attempt_count INTEGER NOT NULL DEFAULT 0 CHECK/);
 assert.match(sql,/CREATE INDEX IF NOT EXISTS score_scheduler_receipts_scheduled_idx/);
 assert.match(sql,/CREATE INDEX IF NOT EXISTS score_scheduler_receipts_outcome_idx/);
 assert.doesNotMatch(sql,/DROP TABLE|DELETE FROM|ALTER TABLE/i);
});
test('scheduler can initialize existing schema and remains opt-in',()=>{
 assert.match(worker,/SCHEDULED_SCORE_COLLECTION_ENABLED==='true'/);
 assert.match(worker,/CREATE TABLE IF NOT EXISTS score_scheduler_receipts/);
 assert.match(worker,/score-scheduler-receipts/);
});
