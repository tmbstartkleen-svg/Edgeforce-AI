import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const compiled=ts.transpileModule(read('../src/lib/gameQuoteOverlay.ts'),{
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true
});
assert.equal(compiled.diagnostics?.length||0,0);
const {verifiedGameQuote,enrichSchedulePrices,strictLeagueMatch}=await import('data:text/javascript,'+encodeURIComponent(compiled.outputText));
const now=Date.parse('2026-10-10T16:00:00Z');
const game={
 id:'NFL:100',sport:'NFL',startTime:'2026-10-10T20:00:00Z',
 home:'Buffalo Bills',away:'Miami Dolphins',homeScore:'',awayScore:'',
 status:'Scheduled',state:'pre',venue:'',quotes:[]
};
const record=(overrides={})=>({
 sport:'NFL',home:'Buffalo Bills',away:'Miami Dolphins',
 startTime:'2026-10-10T20:00:00Z',
 market:'h2h',selection:'Buffalo Bills',odds:-120,bookmaker:'DraftKings',
 sourceTimestamp:'2026-10-10T15:59:00Z',ageMinutes:1,...overrides
});
test('V204 stored odds are only matched to the same sport, teams and start window',()=>{
 const match=verifiedGameQuote(game,record(),now);
 assert.equal(match.market,'h2h');assert.equal(match.selection,'Buffalo Bills');
 assert.equal(verifiedGameQuote(game,record({sport:'NCAAF'}),now),null);
 assert.equal(verifiedGameQuote(game,record({away:'New York Jets'}),now),null);
 assert.equal(verifiedGameQuote(game,record({startTime:'2026-10-10T20:20:00Z'}),now),null);
 assert.equal(verifiedGameQuote({...game,state:'in'},record(),now),null);
 assert.equal(strictLeagueMatch('College Football','NCAAF'),true);
 assert.equal(strictLeagueMatch('NCAAF','NFL'),false);
});
test('V204 quote safety excludes missing/old/future observations, implausible odds and unidentified books',()=>{
 assert.equal(verifiedGameQuote(game,record({sourceTimestamp:''}),now),null);
 assert.equal(verifiedGameQuote(game,record({sourceTimestamp:'2026-10-10T15:45:00Z'}),now),null);
 assert.equal(verifiedGameQuote(game,record({sourceTimestamp:'2026-10-10T16:05:00Z'}),now),null);
 assert.equal(verifiedGameQuote(game,record({ageMinutes:12}),now),null);
 assert.equal(verifiedGameQuote(game,record({odds:90}),now),null);
 assert.equal(verifiedGameQuote(game,record({bookmaker:'unknown'}),now),null);
});
test('V204 market identity allows only recognized two-sided game markets',()=>{
 assert.equal(verifiedGameQuote(game,record({market:'player_points',selection:'Athlete over 20.5'}),now),null);
 assert.equal(verifiedGameQuote(game,record({market:'spreads',selection:'Buffalo Bills -3.5'}),now).selection,'Buffalo Bills -3.5');
 assert.equal(verifiedGameQuote(game,record({market:'totals',selection:'Under 45.5'}),now).selection,'Under 45.5');
 assert.equal(verifiedGameQuote(game,record({market:'totals',selection:'Over 5000'}),now),null);
});
test('V204 stored quote overlay preserves independent bookmaker names and no live-pick status',()=>{
 const result=enrichSchedulePrices(game,[record(),record({bookmaker:'FanDuel',odds:-115})],now);
 assert.equal(result.quotes.length,2);
 assert.equal(result.extraQuoteCount,2);
 assert.equal(result.quoteCoverage,'MATCHED');
 assert.ok(result.quotes.every(q=>q.origin==='stored'));
 const stale=enrichSchedulePrices(game,[record({ageMinutes:100})],now);
 assert.equal(stale.extraQuoteCount,0);
 assert.equal(stale.quoteCoverage,'STALE_ONLY');
});
test('V204 overlay is read-only, bounded and isolated from costly provider fetches',()=>{
 const route=read('../src/app/api/game-odds/route.ts');
 const ui=read('../src/components/GamesWorkspace.tsx');
 assert.match(route,/from market_snapshots ms/);
 assert.match(route,/limit \$\{MAX_ROWS\}/);
 assert.match(route,/sourceTimestamp/);
 assert.doesNotMatch(route,/ingestOdds|fetchNormalizedOdds|fetchTheOddsApiBoard|saveMarketSnapshots/);
 assert.match(ui,/enrichSchedulePrices/);
 assert.match(ui,/fetch\('\/api\/game-odds'/);
 assert.match(ui,/Matching odds were too old/);
 assert.match(ui,/No quoted odds in connected sources/);
 assert.match(ui,/not executable \/ not recommendations/);
});
