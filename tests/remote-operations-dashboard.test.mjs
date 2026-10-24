import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const api=read('src/app/api/operations/remote-dashboard/route.ts');
const ui=read('src/components/RemoteOperationsDashboard.tsx');
test('dashboard endpoint authenticated before database reads and never polls sportsbook APIs',()=>{
 assert.match(api,/request\.headers\.get\('authorization'\)/);
 assert.ok(api.indexOf("request.headers.get('authorization')")<api.indexOf('const sql=db()'));
 assert.doesNotMatch(api,/ingestOdds|fetchNormalizedOdds|fetchFanDuelOddsPulse|fetch\(/);
 assert.match(api,/oddsApiCalls:0/);
});
test('dashboard reports stored DraftKings counts without certifying authenticity',()=>{
 assert.match(api,/draftkings_recent/);
 assert.match(api,/independentUpstreamsCertified:false/);
 assert.match(api,/fullDraftKingsCatalogCertified:false/);
 assert.match(api,/modelsCalibratedCertified:false/);
});
test('dashboard UI has distinct panels, responsive styles, and no token persistence',()=>{
 assert.match(ui,/Sportsbook Coverage/);assert.match(ui,/Agent Monitoring/);
 assert.match(ui,/type="password"/);
 assert.doesNotMatch(ui,/localStorage|sessionStorage|document\.cookie/);
 assert.match(ui,/setInterval/);
});
