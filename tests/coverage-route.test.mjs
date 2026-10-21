import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const route=fs.readFileSync(new URL('../src/app/api/network/v1/coverage/route.ts',import.meta.url),'utf8');
test('coverage endpoint authenticates before consuming supplied snapshots',()=>{
 assert.match(route,/const denied=authorizeNetwork\(request\)/);
 assert.ok(route.indexOf('const denied=authorizeNetwork(request)')<route.indexOf('await request.text()'));
});
test('coverage endpoint does not claim live provider coverage',()=>{
 assert.match(route,/SUPPLIED_SNAPSHOT_ONLY/);
 assert.match(route,/liveConnected:false/);
 assert.doesNotMatch(route,/fetch\(/);
});
test('coverage endpoint limits request and event inventory',()=>{
 assert.match(route,/500_000/);
 assert.match(route,/catalogs.length>8/);
 assert.match(route,/events.length>1000/);
});
