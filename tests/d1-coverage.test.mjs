import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const gateway=fs.readFileSync(new URL('../worker/d1-coverage.ts',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../worker/index.ts',import.meta.url),'utf8');
test('D1 coverage requires a long authenticated server-side secret before querying',()=>{
 assert.match(gateway,/env.CRON_SECRET.length>=24/);
 assert.match(gateway,/checkNetworkAuth\(request.headers.get\('authorization'\),env.EDGEFORCE_NETWORK_TOKEN_SHA256\)/);
 assert.ok(gateway.indexOf("request.headers.get('authorization')")<gateway.indexOf("db.prepare("));
});
test('D1 coverage queries persisted odds only and does not call sportsbooks',()=>{
 assert.match(gateway,/WHERE o\.observation_kind='odds'/);
 assert.match(gateway,/INNER JOIN intelligence_sources AS s/);
 assert.match(gateway,/s\.upstream_id=o\.upstream_id AND s\.enabled=1/);
 assert.doesNotMatch(gateway,/fetch\(/);
 assert.match(gateway,/NO_INDEPENDENT_EXPECTED_CATALOG/);
});
test('Cloudflare Worker includes bounded private D1 coverage route',()=>{
 assert.match(worker,/pathname==='\/api\/operations\/d1-pilot\/coverage'/);
 assert.match(gateway,/limit>250/);
});

test('D1 odds reader unwraps the normalized persisted observation value',()=>{
 assert.match(gateway,/p\.value&&typeof p\.value==='object'/);
 assert.match(gateway,/str\(q\.bookmaker\)/);
 assert.match(gateway,/const price=q\.priceAmerican/);
});

test('first-party score/schedule ledger is queried separately and never treated as a sportsbook quote',()=>{
 assert.match(gateway,/WHERE observation_kind='score'/);
 assert.match(gateway,/classification:'SCORES_NOT_ODDS'/);
 assert.match(gateway,/scheduleObservations/);
 assert.match(gateway,/scoreObservations/);
 assert.match(gateway,/sportsObservations/);
});
