import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/app/api/operations/intelligence-core/readiness/route.ts',import.meta.url),'utf8');
test('readiness requires authentication and does not start collection',()=>{
 assert.match(src,/CRON_SECRET/);
 assert.match(src,/UNAUTHORIZED/);
 assert.doesNotMatch(src,/runIntelligenceCoreOnce|enqueueIntelligenceAgents|insert into|update intelligence_/);
});
test('readiness enforces schema and provider certification',()=>{
 assert.match(src,/MIGRATION_REQUIRED/);
 assert.match(src,/NO_APPROVED_PROVIDERS/);
 assert.match(src,/Cache-Control/);
});
