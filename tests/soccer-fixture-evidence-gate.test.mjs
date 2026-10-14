import test from 'node:test';import assert from 'node:assert/strict';import {gateSoccerFixtures} from '../src/lib/intelligence-core/soccer-fixture-evidence-gate.mjs';
test('no scoreboard-only soccer game is considered rankable',()=>{
 const x=gateSoccerFixtures({requested:[{leagueId:'epl',eventId:'1'},{leagueId:'mls',eventId:'2'}],observed:[{leagueId:'epl',eventId:'1'}]});
 assert.equal(x.rankable,0);assert.equal(x.missingScores,1);assert.equal(x.missingOdds,2);
});
test('unapproved odds do not count, and league IDs prevent fixture collision',()=>{
 const x=gateSoccerFixtures({requested:[{leagueId:'epl',eventId:'1'},{leagueId:'mls',eventId:'1'}],
 observed:[{leagueId:'epl',eventId:'1'}],marketQuoted:[{leagueId:'epl',eventId:'1',authorized:false},{leagueId:'mls',eventId:'1',authorized:true}]});
 assert.equal(x.rankable,0);assert.equal(x.fixtures[0].reason,'NO_AUTHORIZED_MARKET');assert.equal(x.fixtures[1].reason,'MISSING_SCORE_EVIDENCE');
});
test('authorized quote and scoreboard both required',()=>{
 const x=gateSoccerFixtures({requested:[{leagueId:'epl',eventId:'1'}],observed:[{leagueId:'epl',eventId:'1'}],marketQuoted:[{leagueId:'epl',eventId:'1',authorized:true}]});
 assert.equal(x.rankable,1);assert.equal(x.fullDraftKingsInventoryCertified,false);
});
