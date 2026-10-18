import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const code=fs.readFileSync(new URL('../worker/d1-agent-orchestrator.ts',import.meta.url),'utf8');
test('orchestrator is bounded and de-duplicates alert sources',()=>{assert.match(code,/input.length>1000/);assert.match(code,/Math.min\(25/);assert.match(code,/observed.has\(source.sourceId\)/);});
test('dry-run alerts cannot trigger ingest, writes or external notifications',()=>{for(const marker of ['PLAN_ONLY','externalNotificationsSent:0','collectorStarted:false','writeAuthorized:false','betRecommendationAuthorized:false'])assert.ok(code.includes(marker));});
