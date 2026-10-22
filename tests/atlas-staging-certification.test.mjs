import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('staging-only DO proof is routed through authenticated gateway',()=>{
 const gateway=src('worker/atlas-mission-gateway.ts');
 const worker=src('worker/index.ts');
 assert.match(worker,/pathname==='\/api\/network\/staging-certification'/);
 assert.match(gateway,/isCert.*DEPLOYMENT_ENV|env\.DEPLOYMENT_ENV!=='staging'/s);
 assert.match(gateway,/ATLAS_SCHEDULE_EXECUTION_ENABLED!=='false'/);
 assert.match(gateway,/await validToken\(required,supplied\)/);
 assert.match(gateway,/instance\.fetch\(roomRequest\(path/);
});
test('DO proof uses distinct storage and must be deleted',()=>{
 const room=src('worker/atlas-mission-room.ts');
 assert.match(room,/staging-cert-proof/);
 assert.match(room,/storage\.put\(key/);
 assert.match(room,/storage\.get<\{nonce:string;createdAt:number\}>\(key\)/);
 assert.match(room,/storage\.delete\(key\)/);
 assert.match(room,/CERT_PROOF_NOT_FOUND/);
});
test('mainline deploy smoke refuses to inherit autonomous, production, or stale staging secrets',()=>{
 const flow=src('.github/workflows/atlas-staging-auth-smoke.yml');
 assert.match(flow,/branches: \[main\]/);
 assert.match(flow,/edgeforce-ai-cert-staging/);
 assert.match(flow,/EDGEFORCE_STAGING_D1_ID: 882a6b98-2577-48a4-b7cc-21e49c9cc649/);
 assert.match(flow,/ATLAS_SCHEDULE_EXECUTION_ENABLED == "false"/);
 assert.match(flow,/INTELLIGENCE_D1_WRITE_ENABLED == "false"/);
 assert.match(flow,/refusing to overwrite/);
 assert.match(flow,/trap cleanup EXIT/);
 assert.match(flow,/\.persisted == true/);
 assert.match(flow,/\.cleared == true/);
});
