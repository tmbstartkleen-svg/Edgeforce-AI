import test from 'node:test';import assert from 'node:assert/strict';
import {soccerCandidates,soccerCandidate,reconcileFixtureCoverage} from '../src/lib/intelligence-core/soccer-fixture-registry.mjs';
test('candidate expansion does not imply source licensing or enabling',()=>{
 assert.ok(soccerCandidates.length>=15);
 for(const x of soccerCandidates){const item=soccerCandidate(x.id);assert.equal(item.enabled,false);assert.equal(item.oddsLicensed,false);assert.equal(item.status,'UNVERIFIED_CANDIDATE');}
});
test('fixture reconciliation handles league-specific IDs and missing games',()=>{
 const targetFixtures=[{leagueId:'mls',eventId:'100'},{leagueId:'epl',eventId:'100'},{leagueId:'epl',eventId:'101'}];
 const result=reconcileFixtureCoverage({targetFixtures,observedFixtures:[{leagueId:'epl',eventId:'100'}]});
 assert.equal(result.targetFixtureCount,3);assert.equal(result.observedFixtureCount,1);assert.equal(result.missingFixtureCount,2);
 assert.equal(reconcileFixtureCoverage({}).complete,false);
});
