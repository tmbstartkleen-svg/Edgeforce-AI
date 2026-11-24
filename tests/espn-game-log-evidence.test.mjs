import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEspnGameLogEvidence } from '../src/lib/intelligence-core/espn-game-log-evidence.mjs';
const now='2026-11-09T12:00:00Z';
const fixture={names:['assists','rebounds'],events:{
 '1':{gameDate:'2026-11-08',status:{type:{completed:true}},links:[{href:'https://www.espn.com/nba/game/_/gameId/1'}]},
 '2':{gameDate:'2026-11-08',status:{type:{completed:false}},links:[{href:'https://www.espn.com/nba/game/_/gameId/2'}]}
},seasonTypes:[{categories:[{events:[{eventId:'1',stats:['8','5']},{eventId:'2',stats:['6','7']}]}]}]};
test('accepts only explicitly completed sourced game logs',()=>{
 const r=normalizeEspnGameLogEvidence({athleteId:'123',payload:fixture,observedAt:now});
 assert.equal(r.rows.length,1);
 assert.equal(r.rows[0].stats.assists,8);
 assert.equal(r.rows[0].observedAt,now);
 assert.equal(r.excluded[0].reason,'COMPLETION_UNVERIFIED');
 assert.equal(r.approvedForBetting,false);
});
test('missing external link cannot be replaced with fabricated URL',()=>{
 const f=structuredClone(fixture);f.events['1'].links=[];
 const r=normalizeEspnGameLogEvidence({athleteId:'123',payload:f,observedAt:now});
 assert.equal(r.rows.length,0);
 assert.equal(r.excluded[0].reason,'SOURCE_URL_UNVERIFIED');
});
test('rejects empty numeric values rather than converting them to zero',()=>{
 const f=structuredClone(fixture);f.seasonTypes[0].categories[0].events[0].stats=['',''];
 const r=normalizeEspnGameLogEvidence({athleteId:'123',payload:f,observedAt:now});
 assert.equal(r.rows.length,0);
 assert.equal(r.excluded[0].reason,'STATS_UNAVAILABLE');
});
