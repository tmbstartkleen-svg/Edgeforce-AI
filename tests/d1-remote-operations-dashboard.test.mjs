import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const worker=read('worker/index.ts'),dashboard=read('worker/d1-remote-operations-dashboard.ts');
test('Cloudflare routes remote dashboard before legacy postgres fetch and database scope',()=>{
 assert.match(worker,/d1RemoteOperationsDashboard\(request,env\)/);
 assert.ok(worker.indexOf("pathname==='/api/operations/remote-dashboard'")<worker.indexOf('return withDatabaseScope(scoped=>handler.fetch(request'));
});
test('owner authorization and D1 binding precede every dashboard query',()=>{
 assert.match(dashboard,/request\.headers\.get\('authorization'\)/);
 assert.ok(dashboard.indexOf("request.headers.get('authorization')")<dashboard.indexOf('const db=env.INTELLIGENCE_DB'));
 assert.doesNotMatch(dashboard,/ingestOdds|fetchNormalizedOdds|fetchFanDuelOddsPulse/);
});
test('only source-observed fresh approved D1 rows appear as valid quotes',()=>{
 assert.match(dashboard,/source_observed_at>=\?/);
 assert.match(dashboard,/allowed\.get\(x\.provider\)===x\.upstream_id/);
 assert.match(dashboard,/Date\.parse\(x\.source_observed_at\)>=now-20\*60_000/);
 assert.match(dashboard,/independentUpstreamsCertified:false/);
});
test('agent task history is read from D1 without invoking collector or spending credits',()=>{
 assert.match(dashboard,/FROM specialist_tasks/);
 assert.match(dashboard,/oddsApiCalls:0/);
 assert.match(dashboard,/readOnly:true/);
 assert.doesNotMatch(dashboard,/\.run\(|fetch\(/);
});
