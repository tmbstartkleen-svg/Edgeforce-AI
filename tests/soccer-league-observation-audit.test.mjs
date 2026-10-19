import test from 'node:test';import assert from 'node:assert/strict';
import {auditSoccerLeagueObservations} from '../src/lib/intelligence-core/soccer-fixture-registry.mjs';
test('missing and zero-event soccer feeds are distinct',()=>{
 const audit=auditSoccerLeagueObservations([
  {leagueId:'eng.1',fixtures:[{eventId:'abc'},{eventId:'abc'}]},
  {leagueId:'esp.1',fixtures:[]}
 ],[{id:'soccer-epl',code:'eng.1'},{id:'soccer-laliga',code:'esp.1'},{id:'soccer-seriea',code:'ita.1'}]);
 assert.equal(audit.expectedLeagueCount,3);
 assert.equal(audit.observedLeagueCount,2);
 assert.deepEqual(audit.leagues.map(x=>x.coverageStatus),['EVENTS_OBSERVED','ZERO_EVENTS_REPORTED','NOT_OBSERVED']);
 assert.deepEqual(audit.leagues.map(x=>x.fixtureCount),[1,0,0]);
 assert.deepEqual(audit.missingLeagueIds,['soccer-seriea']);
 assert.equal(audit.allSportsbookMarketsVerified,false);
 assert.ok(audit.leagues.every(x=>x.draftKingsInventoryCertified===false));
});
