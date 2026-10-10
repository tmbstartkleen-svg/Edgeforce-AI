import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const odds=readFileSync(new URL('../src/lib/providers/odds.ts',import.meta.url),'utf8');
const status=readFileSync(new URL('../src/app/api/live-data/status/route.ts',import.meta.url),'utf8');
const espn=readFileSync(new URL('../src/lib/providers/espnCoreOdds.ts',import.meta.url),'utf8');
const propLine=readFileSync(new URL('../src/lib/providers/propLine.ts',import.meta.url),'utf8');
const oddsApi2=readFileSync(new URL('../src/lib/providers/oddsApi2.ts',import.meta.url),'utf8');

test('provider coverage telemetry includes sports and market mix',()=>{
 assert.match(odds,/sports:string\[\]/);
 assert.match(odds,/sportCounts:Record<string,number>/);
 assert.match(odds,/playerPropRows:number/);
 assert.match(odds,/teamMarketRows:number/);
 assert.match(status,/providerCoverage:/);
 assert.match(status,/sportCounts:x\.sportCounts/);
});

test('PropLine defaults to observed free-tier candidate sports',()=>{
 assert.match(propLine,/'baseball_mlb,football_nfl,hockey_nhl'/);
 assert.doesNotMatch(propLine,/'football_nfl,football_ncaaf,basketball_nba,hockey_nhl,baseball_mlb,tennis'/);
 assert.match(propLine,/PROPLINE_EMPTY_SPORT_RETRY_MS/);
});

test('ESPN odds rotation prioritizes sports outside PropLine free coverage',()=>{
 assert.match(espn,/const GAP_PRIORITY_IDS=\[/);
 assert.match(espn,/'ncaaf'/);
 assert.match(espn,/'nba'/);
 assert.match(espn,/'ncaam-basketball'/);
 assert.match(espn,/'mls'/);
 assert.match(espn,/const SUPPLEMENTAL_IDS=\[/);
 assert.match(espn,/'nfl'/);
 assert.match(espn,/'nhl'/);
 assert.match(espn,/'mlb'/);
});


test('healthy live provider panel preserves coverage telemetry',()=>{
 const hits=(odds.match(/acceptedMarkets:x\.markets\.length,\.\.\.coverageForMarkets\(x\.markets\)/g)||[]).length;
 assert.ok(hits>=2,`expected coverage telemetry on failed and healthy providerPanel branches, found ${hits}`);
});


test('Odds API 2 discovers accessible free-tier sports and uses current sport keys',()=>{
 assert.match(oddsApi2,/'basketball_nba,baseball_mlb,americanfootball_nfl'/);
 assert.match(oddsApi2,/async function accessibleSports/);
 assert.match(oddsApi2,/\`\$\{baseUrl\(\)\}\/sports\//);
 assert.match(oddsApi2,/accessible\.has\(key\)/);
 assert.match(oddsApi2,/oddsFormat/);
 assert.match(oddsApi2,/regions/);
});
