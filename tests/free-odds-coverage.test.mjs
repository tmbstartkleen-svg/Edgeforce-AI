import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const provider=read('../src/lib/providers/odds.ts');
const api=read('../src/app/api/live-board/route.ts');
const dashboard=read('../src/components/Dashboard.tsx');
const command=read('../src/components/SportsCommandCenter.tsx');
const theOdds=read('../src/lib/providers/theOddsApi.ts');
const sportsGame=read('../src/lib/providers/sportsGameOdds.ts');
const freeScore=read('../src/lib/providers/communityScoreBackups.ts');

test('V199 warns when no second provider was configured, not merely because a configured provider failed',()=>{
 assert.match(provider,/configured\.length===1/);
 assert.match(provider,/Only one odds provider is configured/);
 assert.match(provider,/Only one acceptable odds provider/);
 assert.match(provider,/Inspect provider attempts/);
});
test('V199 independently reports actual sportsbooks and odds upstreams',()=>{
 assert.match(api,/independentlyAcceptedProviders:sourceProviders\.length/);
 assert.match(api,/distinctBookmakers:bookmakerNames\.length/);
 assert.match(api,/bookmakerNames:bookmakerNames\.slice\(0,20\)/);
 assert.match(api,/independentReferenceMarkets/);
 assert.match(dashboard,/Sportsbooks quoted:/);
 assert.match(dashboard,/Markets with multiple books:/);
 assert.match(command,/bookmakerCount/);
 assert.match(dashboard,/providerAttempts/);
});
test('V199 sportsbook API defaults do not invent Kalshi or Polymarket bookmakers',()=>{
 assert.match(theOdds,/draftkings,fanduel,betmgm/);
 assert.doesNotMatch(theOdds,/bookmakers=String\(process\.env\.THE_ODDS_API_BOOKMAKERS\|\|'[^']*kalshi/);
 assert.match(theOdds,/Prediction exchanges use separate, settlement-aware connectors/);
});
test('V199 zero-cost-first research modes enforce bounded polling and page limits',()=>{
 assert.match(theOdds,/THE_ODDS_API_FREE_MODE/);
 assert.match(theOdds,/configuredCacheMs=freeMode\?Math\.max\(10800000/);
 assert.match(theOdds,/configuredMaxSports=freeMode\?0/);
 assert.match(theOdds,/const markets=freeMode\?'h2h'/);
 assert.match(theOdds,/const propLimit=freeMode\?0/);
 assert.match(sportsGame,/SPORTS_GAME_ODDS_FREE_MODE/);
 assert.match(sportsGame,/Math\.max\(21600000/);
 assert.match(sportsGame,/const limit=freeMode\(\)\?10/);
 assert.match(sportsGame,/cursor&&!freeMode\(\)/);
});
test('V199 supplementary score APIs remain separate and cannot be misclassified as bookmaker pricing',()=>{
 assert.match(freeScore,/thesportsdb/);
 assert.doesNotMatch(provider,/thesportsdb/);
 assert.match(api,/ingestion\.panelMarkets/);
});
