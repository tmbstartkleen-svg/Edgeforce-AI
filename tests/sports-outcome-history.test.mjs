import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const input=read('../src/lib/sportsOutcomeHistory.ts');
const out=ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(out.diagnostics?.length??0,0);
const {normalizeFinals,normalizeLicensedPlays}=await import('data:text/javascript,'+encodeURIComponent(out.outputText));
const now=Date.parse('2026-10-10T21:00:00Z');
const game=(overrides={})=>({id:'NFL:fixture123',sport:'NFL',startTime:'2026-10-09T20:00:00Z',
 home:'Buffalo Bills',away:'Miami Dolphins',homeScore:'21',awayScore:'17',status:'Final',state:'post',venue:'',
 quotes:[],...overrides});
test('V209 only recorded final scores with real numeric values are retained',()=>{
 const result=normalizeFinals([game(),game({id:'NFL:fixture124',awayScore:'0'})],'espn-scoreboard','NFL',now);
 assert.equal(result.games.length,2);
 assert.equal(result.games[0].homeScore,21);
 assert.equal(result.games[1].awayScore,0);
 assert.equal(result.games[0].sourceObservedAt,null);
 assert.equal(result.games[0].verification,'SINGLE_SOURCE');
});
test('V209 does not turn scheduled, unfinished, wrong-league, future or ambiguous scores into historical results',()=>{
 const games=[
  game({state:'pre'}),game({homeScore:''}),game({awayScore:'-1'}),
  game({id:'NCAAF:fixture123'}),game({sport:'NCAAF'}),
  game({startTime:'2026-10-11T20:00:00Z'}),
  game({startTime:'2026-01-01T20:00:00Z'}),
  game({away:'Buffalo Bills'}),game({home:'TBD'})
 ];
 const result=normalizeFinals(games,'espn-scoreboard','NFL',now);
 assert.equal(result.games.length,0);
 assert.equal(result.rejected,9);
});
test('V209 repeated final score snapshots deduplicate identity but preserve amended score separately',()=>{
 const result=normalizeFinals([game(),game(),game({homeScore:'22'})],'espn-scoreboard','NFL',now);
 assert.equal(result.games.length,2);
});
test('V209 licensed play batch validates provenance, timestamps and bounded structured stats',()=>{
 const fixture={sourceEventKey:'nfl:fixture123',sourcePlayKey:'play1',sport:'NFL',
  eventTime:'2026-10-09T20:10:00Z',observedAt:'2026-10-09T20:10:05Z',
  description:'Pass complete for twelve yards',playerName:'Fixture Player',
  rawStats:{yards:12,firstDown:true}};
 const valid=normalizeLicensedPlays([fixture],'licensed-pbp-fixture',now);
 assert.equal(valid.length,1);
 assert.equal(valid[0].rawStats.yards,12);
 assert.equal(valid[0].verification,'DECLARED_SOURCE');
 assert.equal(normalizeLicensedPlays([fixture,fixture],'licensed-pbp-fixture',now),null);
 assert.equal(normalizeLicensedPlays([fixture], 'licensed',now)?.length,1);
 assert.equal(normalizeLicensedPlays([{...fixture,eventTime:'2050-01-01T00:00:00Z'}],'licensed',now),null);
 assert.equal(normalizeLicensedPlays([{...fixture,rawStats:{yards:Infinity}}],'licensed',now),null);
 assert.equal(normalizeLicensedPlays(Array.from({length:31},()=>fixture),'licensed',now),null);
});
test('V209 migration distinguishes source final scores from declared licensed events',()=>{
 const schema=read('../db/v209.sql');
 assert.match(schema,/edgeforce_sports_outcomes_v209/);
 assert.match(schema,/unique\(source,source_event_key,home_score,away_score\)/);
 assert.match(schema,/verification text not null default 'SINGLE_SOURCE'/);
 assert.match(schema,/edgeforce_sports_plays_v209/);
 assert.match(schema,/unique\(source,source_event_key,source_play_key\)/);
 assert.match(schema,/edgeforce_sports_outcome_sync_v209/);
});
test('V209 limited source capture and play import remain private, no high-fanout cron',()=>{
 const capture=read('../src/app/api/network/v1/outcomes/capture/route.ts');
 const play=read('../src/app/api/network/v1/plays/import/route.ts');
 const coverage=read('../src/app/api/network/v1/coverage/route.ts');
 const ui=read('../src/components/SportsOutcomeCoverage.tsx');
 const parent=read('../src/components/SportsNetworkChronicle.tsx');
 for(const route of [capture,play,coverage])assert.match(route,/authorizeNetwork\(request\)/);
 assert.match(capture,/EDGEFORCE_OUTCOME_CAPTURE_ENABLED/);
 assert.match(capture,/EDGEFORCE_OUTCOME_ALLOWED_SOURCES/);
 assert.match(capture,/interval '10 minutes'/);
 assert.match(capture,/loadSchedule\(date,0,feed.id\)/);
 assert.match(capture,/on conflict\(source,source_event_key,home_score,away_score\) do nothing/);
 assert.match(play,/EDGEFORCE_PLAY_IMPORT_ENABLED/);
 assert.match(play,/EDGEFORCE_PLAY_ALLOWED_PROVIDERS/);
 assert.match(play,/normalizeLicensedPlays/);
 assert.match(coverage,/GLOBAL_SPORT_REGISTRY/);
 assert.match(coverage,/OBSERVED_DATABASE_COMPLETENESS/);
 assert.match(parent,/SportsOutcomeCoverage token=\{token\}/);
 assert.doesNotMatch(ui,/setInterval|localStorage/);
 assert.doesNotMatch(coverage,/\bfetch\(/);
 assert.doesNotMatch(play,/\bfetch\(/);
});
