import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const s=readFileSync('worker/d1-pilot-market-read.ts','utf8');
test('market snapshot read requires configured bearer authorization before database access',()=>{
 assert.match(s,/AUTH_NOT_CONFIGURED/);assert.match(s,/authorization/);assert.match(s,/UNAUTHORIZED/);
 assert.ok(s.indexOf('UNAUTHORIZED')<s.indexOf('const rows=await getRecentMarketSnapshots'));
 assert.match(s,/Cache-Control/);
});
