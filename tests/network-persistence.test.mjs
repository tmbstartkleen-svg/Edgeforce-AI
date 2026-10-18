import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const wrangler=JSON.parse(read('wrangler.jsonc'));
const room=read('worker/atlas-mission-room.ts');
const gateway=read('worker/atlas-mission-gateway.ts');
const worker=read('worker/index.ts');
const director=read('src/app/api/network/director/route.ts');
const ui=read('src/components/NetworkCommand.tsx');

test('Build 408 adds an append-only SQLite Durable Object migration and exact binding',()=>{
 assert.deepEqual(wrangler.durable_objects.bindings,[{name:'ATLAS_MISSION_ROOM',class_name:'AtlasMissionRoom'}]);
 assert.ok(wrangler.migrations.some(x=>x.tag==='atlas-mission-room-v1'&&x.new_sqlite_classes?.includes('AtlasMissionRoom')));
 assert.match(worker,/export \{AtlasMissionRoom\} from '\.\/atlas-mission-room'/);
 assert.match(worker,/atlasGateway/);
 assert.match(worker,/\/api\/network\/missions/);
});

test('mission history and writes are private and owner-authenticated before invoking director',()=>{
 assert.match(gateway,/await validToken\(required,supplied\)/);
 assert.match(gateway,/crypto\.subtle\.digest\('SHA-256'/);
 assert.match(gateway,/if\(!await validToken\(required,supplied\)\)return json\(\{ok:false,error:'UNAUTHORIZED'/);
 assert.match(gateway,/ATLAS_JOURNAL_UNAVAILABLE/);
 assert.match(gateway,/if\(isHistory\)/);
 assert.match(gateway,/if\(!reservation\.ok\)/);
 assert.match(gateway,/return json\(\{\.\.\.original,missionId:id,durable:true,persisted:true\}\)/);
 assert.match(gateway,/MISSION_PERSISTENCE_FAILED/);
 assert.ok(gateway.indexOf('await validToken(required,supplied)')<gateway.indexOf('await forward(request)'),'authorization must precede research');
});

test('durable journal is bounded, atomic and fail-closed for writes',()=>{
 assert.match(room,/class AtlasMissionRoom/);
 assert.match(room,/MAX_MISSIONS=30/);
 assert.match(room,/MAX_MINUTE=2/);
 assert.match(room,/MAX_HOUR=12/);
 assert.match(room,/state\.storage\.transaction/);
 assert.match(room,/slice\(-MAX_MISSIONS\)/);
 assert.match(room,/previous\.some\(x=>x\.id===entry\.id\)/);
 assert.match(room,/url\.hostname!=='atlas\.internal'/);
 assert.match(room,/response\.ok!==true/);
});

test('UI restores private history explicitly with no browser-persisted Founder token',()=>{
 assert.match(ui,/\/api\/network\/missions\?limit=15/);
 assert.match(ui,/Restore saved missions/);
 assert.match(ui,/setHistory\(entries\.map/);
 assert.match(ui,/type="password"/);
 assert.doesNotMatch(ui,/localStorage/);
 assert.doesNotMatch(ui,/sessionStorage/);
 assert.match(director,/EDGEFORCE_NETWORK_OWNER_TOKEN/);
});
