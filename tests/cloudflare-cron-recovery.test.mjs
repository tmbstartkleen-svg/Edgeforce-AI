import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const worker=readFileSync(new URL('../worker/index.ts',import.meta.url),'utf8');
const wrangler=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
const decision=readFileSync(new URL('../src/app/api/cron/decision/route.ts',import.meta.url),'utf8');
const predictions=readFileSync(new URL('../src/app/api/cron/predictions/route.ts',import.meta.url),'utf8');
const deploy=readFileSync(new URL('../.github/workflows/deploy-cloudflare.yml',import.meta.url),'utf8');
const liveComebackRoute=readFileSync(new URL('../src/app/api/live-comeback/route.ts',import.meta.url),'utf8');
const liveComeback=readFileSync(new URL('../src/lib/liveComeback.ts',import.meta.url),'utf8');
const scanner=readFileSync(new URL('../src/lib/scanner.ts',import.meta.url),'utf8');

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


test('prediction warehouse supports cron automation and authenticated deployment priming',()=>{
 assert.match(predictions,/process\.env\.CRON_SECRET,process\.env\.INGEST_SECRET/);
 assert.match(predictions,/secrets\.some\(secret=>auth===`Bearer \$\{secret\}`\)/);
 const prime=deploy.slice(deploy.indexOf('Prime prediction intelligence warehouse'));
 assert.match(prime,/Authorization: Bearer \$INGEST_SECRET/);
 assert.doesNotMatch(prime,/Authorization: Bearer \$CRON_SECRET/);
});


test('live comeback uses a bounded Worker-safe path instead of full context fan-out',()=>{
 assert.doesNotMatch(liveComebackRoute,/enrichMarketsWithContext/);
 assert.match(liveComebackRoute,/prepareWorkerSafeLiveComebackMarkets/);
 assert.match(liveComebackRoute,/simulationRunCap:1000/);
 assert.match(liveComebackRoute,/minDaysOut:-\.25/);
 assert.match(liveComeback,/LIVE_COMEBACK_MAX_MARKETS=24/);
 assert.match(liveComeback,/externalContextRequests:0/);
 assert.match(scanner,/simulationRunCap\?:SimulationTier/);
 assert.match(scanner,/options\.minDaysOut\?\?0/);
});


test('prediction warehouse prime waits for Worker secret and route convergence',()=>{
 const prime=deploy.slice(deploy.indexOf('Prime prediction intelligence warehouse'));
 assert.match(prime,/for ATTEMPT in \{1\.\.10\}/);
 assert.match(prime,/HTTP_CODE.*401/);
 assert.match(prime,/HTTP_CODE.*503/);
 assert.match(prime,/Cache-Control: no-store/);
 assert.match(prime,/prediction-prime route\/secret convergence/);
});


test('preview deployment uses isolated Wrangler configuration without cron triggers',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/preview-cloudflare.yml',import.meta.url),'utf8');
 const prepare=readFileSync(new URL('../scripts/prepare-cloudflare-temporary-preview.mjs',import.meta.url),'utf8');
 assert.match(workflow,/wrangler preview --config dist\/server\/wrangler\.preview\.json --ignore-base-config/);
 assert.match(workflow,/node scripts\/prepare-cloudflare-temporary-preview\.mjs/);
 assert.match(prepare,/delete preview\.triggers/);
 assert.match(prepare,/preview\.previews=\{vars:/);
 assert.match(prepare,/preview\.vars=\{\.\.\.config\.vars\}/);
});
