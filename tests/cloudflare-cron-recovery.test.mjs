import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const worker=readFileSync(new URL('../worker/index.ts',import.meta.url),'utf8');
const wrangler=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
const decision=readFileSync(new URL('../src/app/api/cron/decision/route.ts',import.meta.url),'utf8');

test('Cloudflare cron runs source handlers directly instead of routing scheduled work through Vinext',()=>{
 assert.match(worker,/import \{GET as runInjuryCron\}/);
 assert.match(worker,/callScheduledRoute/);
 const scheduledBody=worker.slice(worker.indexOf('async scheduled('));
 assert.doesNotMatch(scheduledBody,/handler\.fetch\(/);
});

test('hourly automation is sharded across separate scheduled invocations',()=>{
 assert.deepEqual(wrangler.triggers.crons,[
  '*/15 * * * *',
  '3,13,23,33,43,53 * * * *',
  '15,45 6 * * *'
 ]);
 for(const minute of [3,13,23,33,43,53])assert.match(worker,new RegExp(`minute===${minute}`));
});

test('decision cron degrades cleanly when no fresh sportsbook markets exist',()=>{
 assert.match(decision,/degraded:true/);
 assert.match(decision,/recordAutomationRun\('decision','success'/);
 assert.match(decision,/status:200/);
 assert.doesNotMatch(decision,/No live or fresh stored sportsbook markets[\s\S]*status:503/);
});
