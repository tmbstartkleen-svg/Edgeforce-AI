import test from 'node:test';
import assert from 'node:assert/strict';
import {auditSoccerCoverage} from '../scripts/soccer-coverage-audit.mjs';
test('soccer coverage persona identifies missing leagues and refuses false completion',()=>{
 const result=auditSoccerCoverage();
 assert.equal(result.verifiedComplete,false);
 assert.equal(result.liveDraftKingsOddsVerified,false);
 assert.ok(result.targetLeagueCount>=30);
 assert.ok(result.activeApprovedScoreboardLeagues.includes('Premier League'));
 assert.ok(result.uncoveredTargets.includes('Spain - La Liga'));
 assert.ok(result.uncoveredTargets.includes('Champions League'));
 assert.ok(result.missingLeagueCount>20);
});
