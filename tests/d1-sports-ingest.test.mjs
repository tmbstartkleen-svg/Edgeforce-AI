import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const source=fs.readFileSync('worker/d1-sports-ingest.ts','utf8');
const route=fs.readFileSync('worker/d1-standalone.ts','utf8');
test('sports writes require secret and explicit write enablement',()=>{
 assert.match(source,/UNAUTHORIZED/);assert.match(source,/D1_WRITE_DISABLED/);
 assert.match(source,/SOURCE_NOT_REGISTERED_IN_D1/);
 assert.match(source,/PAYLOAD_TOO_LARGE/);
 assert.match(route,/\/api\/operations\/d1-pilot\/sports-ingest/);
});
test('no unsafe Neon mutations or automatic collector execution',()=>{
 assert.doesNotMatch(source,/DELETE FROM|DROP TABLE|postgres\(/i);
 assert.doesNotMatch(source,/setInterval|scheduled\(/);
});

test('sports writes require an independent, disabled-by-default enablement gate',()=>{
 assert.match(source,/SPORTS_D1_WRITE_ENABLED/);
 assert.doesNotMatch(source,/env\.INTELLIGENCE_D1_WRITE_ENABLED/);
 const config=fs.readFileSync('wrangler.d1-pilot.jsonc','utf8');
 assert.equal(JSON.parse(config).vars.SPORTS_D1_WRITE_ENABLED,'false');
});
