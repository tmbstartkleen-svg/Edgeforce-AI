import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzePlayerStatStreak} from '../src/lib/intelligence-core/player-streak-research.mjs';

const rows = Array.from({length:10},(_,i)=>({
  eventId:'game-'+i,date:new Date(Date.UTC(2026,10,8-i)).toISOString(),
  completed:true,stats:{assists:i<5?6: i<8?5:7},opponent:'Team '+i,
  sourceUrl:'https://www.espn.com/'
}));
test('last-five verified assists streak and last-ten hit count are distinguished',()=>{
 const result=analyzePlayerStatStreak({games:rows,stat:'assists',threshold:6,asOf:'2026-11-08T00:00:00Z'});
 assert.equal(result.last5.hits,5);
 assert.equal(result.last5.hitRate,1);
 assert.equal(result.last10.hits,7);
 assert.equal(result.last10.hitRate,.7);
 assert.equal(result.consecutive,5);
 assert.equal(result.modelProbability,null);
 assert.equal(result.seasonAverage,null);
 assert.equal(result.games[0].eventId,'game-0');
});
test('partial sample has no misleading full-window percentage',()=>{
 const result=analyzePlayerStatStreak({games:rows.slice(0,4),stat:'assists',threshold:6});
 assert.equal(result.last5.complete,false);
 assert.equal(result.last5.hitRate,null);
 assert.equal(result.last5.observed,4);
});
test('missing stats, pending games and duplicated events do not count as misses',()=>{
 const result=analyzePlayerStatStreak({games:[
 ...rows.slice(0,2),{...rows[2],stats:{}},
 {...rows[3],completed:false},{...rows[0]}
 ],stat:'assists',threshold:6});
 assert.equal(result.verifiedGames,2);
 assert.equal(result.last5.complete,false);
 assert.ok(result.warnings.some(x=>x.startsWith('MISSING_STAT_EXCLUDED')));
 assert.ok(result.warnings.includes('DUPLICATE_GAME_EXCLUDED'));
});
test('rejects malformed configuration and sorts reversed game logs',()=>{
 assert.throws(()=>analyzePlayerStatStreak({games:[],stat:'assists',threshold:NaN}),/INVALID_STREAK_INPUT/);
 const result=analyzePlayerStatStreak({games:[...rows].reverse(),stat:'assists',threshold:6});
 assert.equal(result.games[0].eventId,'game-0');
});
