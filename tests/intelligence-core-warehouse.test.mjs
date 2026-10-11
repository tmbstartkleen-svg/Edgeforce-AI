import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../db/v119.sql',import.meta.url),'utf8');
const runner=readFileSync(new URL('../scripts/migrate.mjs',import.meta.url),'utf8');

test('migration runner discovers versioned SQL files transactionally',()=>{
 assert.match(runner,/\^v\\d\+\\.sql\$/);
 assert.match(runner,/await sql\.begin\(async tx=>/);
});
test('warehouse preserves independent upstream and event timestamps',()=>{
 for(const field of ['upstream_id text not null','observed_at timestamptz not null','payload_hash text not null','payload jsonb not null'])
  assert.ok(sql.includes(field),field);
 assert.match(sql,/unique\(source_id,event_id,observation_kind,observed_at,payload_hash\)/);
});
test('agent runs have idempotency keys and leased run metadata',()=>{
 assert.match(sql,/run_key text not null unique/);
 assert.match(sql,/lease_until timestamptz/);
 assert.match(sql,/budget_units integer not null default 0/);
});
test('model probabilities have a numeric range and provenance',()=>{
 assert.match(sql,/check\(probability>=0 and probability<=1\)/);
 assert.match(sql,/inputs_cutoff_at timestamptz not null/);
 assert.match(sql,/calibration_status text not null default 'UNVERIFIED'/);
});
test('does not mutate existing provider, cron, or prediction tables',()=>{
 assert.doesNotMatch(sql,/\b(drop|truncate|alter)\s+(table|index)\b/i);
});
