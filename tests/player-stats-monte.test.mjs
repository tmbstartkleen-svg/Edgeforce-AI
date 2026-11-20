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
 assert.match(ctx,/source or freshness check failed/);
});
test('client component directive precedes imports and stale results reset',()=>{
 assert.match(page,/^'use client';/);
 assert.match(page,/setMonteResult\(null\)/);
 assert.match(page,/Live forecast readiness: Not verified/);
});
