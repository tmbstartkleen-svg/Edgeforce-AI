import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=(path)=>fs.readFileSync(new URL('../src/lib/'+path,import.meta.url),'utf8');
const page=fs.readFileSync(new URL('../src/app/player-stats/page.tsx',import.meta.url),'utf8');

test('player research requires observed games, not synthetic box scores',()=>{
 const s=source('playerPropResearch.ts');
 assert.match(s,/samples\.length<5/);
 assert.match(s,/estimatedOverProbability:null/);
});
test('Monte is seeded and remains research only',()=>{
 const s=source('playerPropMonteResearch.ts');
 assert.match(s,/hashSeed\(seed/);
 assert.match(s,/UNCALIBRATED/);
 assert.doesNotMatch(s,/eligibleForVerifiedAlert:true/);
});
test('pregame simulation blocks missing context and future game logs',()=>{
 const s=source('contextualPlayerMonte.ts');
 const ctx=source('playerPregameContext.ts');
 assert.match(s,/if\(!assessed\.ready/);
 assert.match(s,/pregameHistory\(games,context\.gameTime\)/);
 assert.match(ctx,/Date\.parse\(g\.stat_date\)<cutoff/);
 assert.match(ctx,/g\.stat_date<gameTime\.slice\(0,10\)/);
 assert.match(ctx,/source or freshness check failed/);
});
test('client component directive precedes imports and stale results reset',()=>{
 assert.match(page,/^'use client';/);
 assert.match(page,/setMonteResult\(null\)/);
 assert.match(page,/Live forecast readiness: Not verified/);
});

const playerApi=fs.readFileSync(new URL('../src/app/api/player/[id]/route.ts',import.meta.url),'utf8');
const parser=source('playerStatQuestions.ts');
test('player API exposes opponent, venue, minutes and source evidence',()=>{
 for(const field of ['opponent','home_away','minutes','source'])assert.match(playerApi,new RegExp('\\b'+field+'\\b'));
});
test('question parser matches complete tokens rather than substrings',()=>{
 assert.match(parser,/tokens\.includes\(n\)/);
 assert.doesNotMatch(parser,/q\.includes\(n\)/);
 assert.match(parser,/phrase\.includes\(' '\+n\+' '\)/);
 assert.match(parser,/passing yards/);
 assert.match(parser,/keys\.some\(alias=>norm\(alias\)===norm\(k\)\)/);
});
test('Monte is disabled during loading or demo history',()=>{
 assert.match(page,/disabled=\{loading\|\|!minutesInputValid\|\|propResearch\.status/);
 assert.match(page,/playerSource!=='database'/);
});

test('Monte rejects out-of-range expected minutes rather than silently ignoring them',()=>{
 const monte=source('playerPropMonteResearch.ts');
 assert.match(monte,/options\.expectedMinutes!==undefined&&\(!Number\.isFinite\(options\.expectedMinutes\)\|\|options\.expectedMinutes<=0\|\|options\.expectedMinutes>60\)/);
 assert.match(monte,/return empty\('invalid'\)/);
});

test('player game history has deterministic ordering for same-date events',()=>{
 assert.match(playerApi,/order by stat_date desc, event_id desc limit 50/);
});

test('in-play entry planner is research only and does not submit orders',()=>{
 const planner=source('inPlayLimitEntryPlanner.ts');
 assert.match(planner,/platform:'kalshi'\|'polymarket'/);
 assert.match(planner,/strategy:EntryStrategy/);
 assert.match(planner,/targetFillProbability:0\.6\|0\.8\|0\.95/);
 assert.match(planner,/estimatedFillProbability:fill/);
 assert.match(planner,/no guaranteed fill/);
 assert.doesNotMatch(planner,/fetch\(|orders\.create\(|placeOrder\(/);
});

test('pregame planner requires sourced price-path scenarios and separates touches from fills',()=>{
 const planner=source('pregameMarketEntryPlanner.ts');
 assert.match(planner,/if\(input\.scenarios\.length===0\)return result\('insufficient_evidence'\)/);
 assert.match(planner,/fillProbability>s\.touchProbability/);
 assert.match(planner,/A touch does not imply an order fill/);
 assert.doesNotMatch(planner,/orders\.create\(|placeOrder\(/);
});
