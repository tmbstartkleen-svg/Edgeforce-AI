import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../scripts/odds-probe-live.mjs',import.meta.url),'utf8');
test('live probe must require explicit user acknowledgement and local key',()=>{
 assert.match(source,/--ack-provider-charge/);
 assert.match(source,/THE_ODDS_API_KEY_NOT_CONFIGURED_LOCALLY/);
 assert.match(source,/process\.env\.THE_ODDS_API_KEY/);
 assert.match(source,/redirect:'error'/);
 assert.match(source,/setTimeout\(\(\)=>controller.abort\(\),12000\)/);
});
test('one paid request only and no D1 side effects or key leakage',()=>{
 assert.equal((source.match(/await fetch\(/g)||[]).length,1);
 assert.doesNotMatch(source,/\.run\(\)|INSERT INTO|appendD1Observations|writeFile|process\.env\.CRON_SECRET/);
 assert.match(source,/Never log raw upstream error bodies/);
 assert.match(source,/console\.error\('LIVE_SOURCE_PROBE_FAILED'\)/);
 assert.match(source,/quota/);
 assert.match(source,/certified:false/);
});
test('probe requests only provider core DK h2h for bounded read-only evidence',()=>{
 assert.match(source,/searchParams\.set\('bookmakers','draftkings'\)/);
 assert.match(source,/searchParams\.set\('markets','h2h'\)/);
 assert.match(source,/PROVIDER_RESPONSE_TOO_LARGE/);
 assert.match(source,/targetQuoteCount/);
});
