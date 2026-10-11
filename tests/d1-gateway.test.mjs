import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const gate=fs.readFileSync('worker/d1-gateway.ts','utf8');
const worker=fs.readFileSync('worker/index.ts','utf8');
test('D1 gateway is explicit opt-in and authenticated',()=>{
 assert.match(gate,/INTELLIGENCE_D1_WRITE_ENABLED/);
 assert.match(gate,/D1_WRITE_DISABLED/);
 assert.match(gate,/authorized\(request,env.INGEST_SECRET\)/);
 assert.match(gate,/authorized\(request,env.CRON_SECRET\)/);
 assert.match(gate,/PAYLOAD_TOO_LARGE/);
 assert.match(gate,/items.length>25/);
 assert.match(worker,/d1IngestGateway\(request,env\)/);
 assert.match(worker,/d1RecentGateway\(request,env\)/);
});
