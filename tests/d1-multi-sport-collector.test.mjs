import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {scoreSports,scoreboardSource} from '../src/lib/intelligence-core/score-source-catalog.mjs';
const c=readFileSync('worker/d1-multi-sport-collector.ts','utf8');
test('multi-sport D1 collector is fail closed and supports entire allowlist',()=>{
 assert.equal(scoreSports.length,16);
 for(const sport of scoreSports)assert.equal(scoreboardSource(sport.id).classification,'SCORES_NOT_ODDS');
 assert.match(c,/COLLECTION_DISABLED/);
 assert.match(c,/SOURCE_NOT_APPROVED/);
 assert.match(c,/SPORT_NOT_APPROVED/);
 assert.match(c,/appendD1Observations/);
 assert.match(c,/AbortSignal\.timeout\(6500\)/);
 assert.match(c,/competitors\.length!==2/);
 assert.match(c,/recordType:isScheduled\?'SCHEDULE'/);
 assert.match(c,/score:hasScores&&!isScheduled\?x.score:null/);
});

test('soccer network catalog includes major licensed-reference league identifiers and never calls them odds',()=>{
 const leagues=['soccer-epl','soccer-laliga','soccer-bundesliga','soccer-serie-a','soccer-ligue-1','soccer-mls','soccer-nwsl','soccer-ucl','soccer-uel'];
 for(const league of leagues){
  const source=scoreboardSource(league);
  assert.equal(source.classification,'SCORES_NOT_ODDS');
  assert.match(source.endpoint,/^https:\/\/site\.api\.espn\.com\/apis\/site\/v2\/sports\/soccer\//);
 }
});

test('Cloudflare Worker exposes scoreboard collector only behind collector-owned authorization and feature gate',()=>{
 const worker=readFileSync('worker/index.ts','utf8');
 assert.match(worker,/pathname==='\/api\/operations\/d1-pilot\/collect-scores'/);
 assert.match(worker,/collectMultiSportScores\(request,env\)/);
 assert.match(c,/UNAUTHORIZED/);
 assert.match(c,/SPORTS_SCORE_COLLECT_ENABLED/);
 assert.match(c,/SOURCE_NOT_APPROVED/);
});

test('isolated pilot exposes protected read-only registry diagnostic without collection',()=>{
 const standalone=readFileSync('worker/d1-standalone.ts','utf8');
 const readiness=readFileSync('worker/d1-score-collector-readiness.ts','utf8');
 assert.match(standalone,/pathname==='\/api\/operations\/d1-pilot\/score-collector-readiness'/);
 assert.match(readiness,/method!=='GET'/);
 assert.match(readiness,/UNAUTHORIZED/);
 assert.match(readiness,/READ_ONLY_SOURCE_REGISTRATION_AUDIT/);
 assert.match(readiness,/scoreSports\.map/);
 assert.match(readiness,/UPSTREAM_MISMATCH/);
 assert.doesNotMatch(readiness,/INSERT|UPDATE|DELETE|fetch\(/);
});

test('multi-sport collector refuses D1 writes unless independently opted in',()=>{
 assert.match(c,/INTELLIGENCE_D1_WRITE_ENABLED!=='true'/);
 assert.match(c,/D1_WRITE_DISABLED/);
 assert.ok(c.indexOf('D1_WRITE_DISABLED')<c.indexOf('fetch(source.endpoint'));
});

test('collector does not falsely certify invalid, empty, or all-rejected source batches',()=>{
 assert.match(c,/INVALID_SCOREBOARD_PAYLOAD/);
 assert.match(c,/NO_QUALIFYING_EVENTS/);
 assert.match(c,/const persisted=report\.accepted\+report\.duplicates/);
 assert.match(c,/report\.rejected===0&&persisted>0/);
 assert.match(c,/persisted>0\?200:422/);
});

test('staging real upstream probe cannot mutate D1 or manufacture odds',()=>{
 const worker=readFileSync('worker/d1-standalone.ts','utf8');
 const probe=readFileSync('worker/d1-score-source-probe.ts','utf8');
 assert.match(worker,/probe-score-source/);
 assert.match(probe,/CRON_SECRET\.length<24/);
 assert.match(probe,/SOURCE_NOT_APPROVED/);
 assert.match(probe,/SPORT_NOT_APPROVED/);
 assert.match(probe,/REAL_UPSTREAM_READ_ONLY_PROBE/);
 assert.match(probe,/SCORES_NOT_ODDS/);
 assert.match(probe,/persisted:false/);
 assert.doesNotMatch(probe,/INSERT|UPDATE|DELETE|appendD1Observations/);
});

test('read-only upstream probe fails closed when no usable events are returned',()=>{
 const probe=readFileSync('worker/d1-score-source-probe.ts','utf8');
 assert.match(probe,/scheduled\+scored===0/);
 assert.match(probe,/NO_QUALIFYING_UPSTREAM_EVENTS/);
 assert.match(probe,/status:422/);
});

test('NFL scoreboard upstream request is bounded without relaxing the 250KB source gate',()=>{
 const source=scoreboardSource('nfl');
 assert.equal(new URL(source.endpoint).searchParams.get('limit'),'10');
 assert.match(new URL(source.endpoint).searchParams.get('dates')||'',/^\\d{8}$/);
 const utc=new Date(Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth(),new Date().getUTCDate()));
 utc.setUTCDate(utc.getUTCDate()+(7-utc.getUTCDay())%7);
 assert.equal(new URL(source.endpoint).searchParams.get('dates'),utc.toISOString().slice(0,10).replace(/-/g,''));
 const probe=readFileSync('worker/d1-score-source-probe.ts','utf8');
 assert.match(probe,/250000/);
 assert.match(c,/250000/);
 assert.equal(new URL(scoreboardSource('nhl').endpoint).searchParams.get('limit'),'10');
 assert.match(new URL(scoreboardSource('nhl').endpoint).searchParams.get('dates')||'',/^\d{8}$/);
});

test('NFL 422 diagnostic reports actual empty or unsupported events and never claims writes',()=>{
 const probe=readFileSync('worker/d1-score-source-probe.ts','utf8');
 assert.match(probe,/EMPTY_OR_UNSUPPORTED_SCOREBOARD/);
 assert.match(probe,/receivedEvents:parsed.events.length/);
 assert.match(probe,/inspectedEvents:Math.min\(15,parsed.events.length\)/);
 assert.match(probe,/NO_QUALIFYING_UPSTREAM_EVENTS/);
 assert.match(probe,/persisted:false/);
});

test('NCAAF scoreboard caps large upstream by upcoming Saturday and one event',()=>{
 const source=scoreboardSource('ncaaf');
 const query=new URL(source.endpoint).searchParams;
 assert.equal(query.get('limit'),'1');
 assert.match(query.get('dates')||'',/^\\d{8}$/);
 const utc=new Date(Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth(),new Date().getUTCDate()));
 utc.setUTCDate(utc.getUTCDate()+(6-utc.getUTCDay()+7)%7);
 assert.equal(query.get('dates'),utc.toISOString().slice(0,10).replace(/-/g,''));
 const probe=readFileSync('worker/d1-score-source-probe.ts','utf8');
 assert.match(probe,/250000/);
 assert.match(c,/250000/);
});
