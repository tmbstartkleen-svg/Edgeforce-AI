import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/app/api/operations/intelligence-core/providers/route.ts',import.meta.url),'utf8');
test('requires authorization and remains read-only',()=>{
 assert.match(src,/CRON_SECRET/);
 assert.match(src,/UNAUTHORIZED/);
 assert.doesNotMatch(src,/insert into|update intelligence_|delete from|enqueueIntelligenceAgents|runIntelligenceCoreOnce/i);
});
test('requires migrated warehouse and reports provenance freshness',()=>{
 assert.match(src,/MIGRATION_REQUIRED/);
 assert.match(src,/newest_source_timestamp/);
 assert.match(src,/NO_DATA/);
 assert.match(src,/INVALID_FUTURE_TIMESTAMP/);
 assert.match(src,/independentOddsUpstreams/);
});
test('does not claim independent live odds coverage from registry',()=>{
 assert.match(src,/configuration-based, not verification of live quotes/);
 assert.match(src,/sourceType==='sportsbook-odds'/);
});
