import test from 'node:test';import assert from 'node:assert/strict';
import {enforceSoccerEvidence,isSoccerBoardRow} from '../src/lib/intelligence-core/soccer-live-board-gate.mjs';
test('soccer selections never enter rankings without verified joining capability',()=>{const r=enforceSoccerEvidence([{sport:'Soccer',id:'1'},{sport:'NFL',id:'2'},{sport:'soccer-epl',id:'3'}]);assert.deepEqual(r.eligible.map(x=>x.id),['2']);assert.equal(r.withheldSoccerCount,2);assert.equal(r.gateEnforced,true)});
test('American football remains separate from soccer',()=>{assert.equal(isSoccerBoardRow({sport:'College Football'}),false);assert.equal(isSoccerBoardRow({sport:'Football'}),false);assert.equal(isSoccerBoardRow({sport:'MLS'}),true)});
