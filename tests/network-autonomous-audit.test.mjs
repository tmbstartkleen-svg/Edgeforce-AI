import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(p)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const engine=read('worker/atlas-autonomous-audit.ts');
const room=read('worker/atlas-mission-room.ts');
const gateway=read('worker/atlas-mission-gateway.ts');
const worker=read('worker/index.ts');
const ui=read('src/components/NetworkCommand.tsx');

test('Build 410 audit uses existing D1 metadata only, and starts disabled',()=>{
 assert.match(engine,/enabled:false/);
 assert.match(engine,/D1_SOURCE_AUDIT|READ_ONLY_D1_METADATA/);
 assert.match(engine,/SELECT source_id AS source, MAX\(observed_at\)/);
 assert.match(engine,/FROM intelligence_observations/);
 assert.doesNotMatch(engine,/https:\/\//);
 assert.doesNotMatch(engine,/api\.openai|draftkings\.com|PLACE_BET/);
});
test('Cloudflare DO alarm scheduling is owner-opt-in and bounded',()=>{
 assert.match(room,/async alarm\(\)/);
 assert.match(engine,/setAlarm/);
 assert.match(engine,/deleteAlarm/);
 assert.match(engine,/\[60,180,360\]/);
 assert.match(engine,/MAX_ATTEMPTS=3/);
 assert.match(engine,/RETRY/);
 assert.match(engine,/AUDIT_PENDING/);
 assert.match(engine,/SOURCE_EMPTY|EMPTY/);
 assert.match(engine,/STALE/);
});
test('Audit controls pass through Founder-authenticated gateway only',()=>{
 assert.match(worker,/pathname==='\/api\/network\/audit'/);
 assert.match(gateway,/isAudit=url\.pathname==='\/api\/network\/audit'/);
 assert.match(gateway,/await validToken\(required,supplied\)/);
 assert.match(gateway,/roomRequest\('\/audit\/status'/);
 assert.match(gateway,/roomRequest\('\/audit\/configure'/);
 assert.match(gateway,/roomRequest\('\/audit\/queue'/);
 assert.ok(gateway.indexOf('await validToken(required,supplied)')<gateway.indexOf('if(isAudit)'));
});
test('Founder can enable or disable audits; alerts remain internal',()=>{
 assert.match(ui,/Autonomous Operations/);
 assert.match(ui,/Enable monitoring/);
 assert.match(ui,/Disable monitoring/);
 assert.match(ui,/Run one audit/);
 assert.match(ui,/\/api\/network\/audit/);
 assert.match(engine,/externalAlerts:false/);
 assert.match(ui,/No external data purchases/);
});
