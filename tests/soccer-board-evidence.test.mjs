import test from 'node:test';import assert from 'node:assert/strict';
import {soccerBoardEvidence} from '../src/lib/intelligence-core/soccer-board-evidence.mjs';
test('scoreboard-only metadata never proves licensed soccer fixture coverage',()=>{
 const report=soccerBoardEvidence([{id:'1',sport:'Soccer',league:'EPL',event:'A-B',sourceEventId:'abc',sourceBook:'DraftKings'},
   {id:'2',sport:'NFL',league:'NFL'}]);
 assert.equal(report.boardSoccerRows,1);assert.equal(report.fixtureLinksVerified,0);
 assert.equal(report.details[0].status,'UNVERIFIED_FIXTURE_JOIN');assert.equal(report.gateEnforced,false);
});
