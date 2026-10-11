import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const wrangler=fs.readFileSync('wrangler.jsonc','utf8');
const sql=fs.readFileSync('db/d1/0001_intelligence_pilot.sql','utf8');
const worker=fs.readFileSync('worker/index.ts','utf8');
const handler=fs.readFileSync('worker/d1-pilot.ts','utf8');
test('D1 pilot is opt-in and does not replace postgres',()=>{
 const config=JSON.parse(wrangler);
 assert.equal(config.d1_databases?.[0]?.binding,"INTELLIGENCE_DB");
 assert.match(worker,/d1PilotReadiness/);
 assert.match(worker,/\/api\/operations\/d1-pilot\/readiness/);
 assert.match(handler,/UNAUTHORIZED/);
 assert.match(handler,/D1_BINDING_MISSING/);
 assert.doesNotMatch(handler,/\.run\(/);
 assert.match(sql,/UNIQUE\(source_id,event_id,observation_kind,observed_at,payload_hash\)/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS intelligence_observations/);
});
