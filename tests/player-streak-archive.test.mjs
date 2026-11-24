import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStoredPlayerGames } from '../src/lib/intelligence-core/player-streak-archive.mjs';
import { reviewPlayerStreakEvidence } from '../src/lib/intelligence-core/player-streak-evidence.mjs';

const row = (id, edits={}) => ({
  eventId:id, athleteId:'player-11', statDate:'2026-11-02T00:00:00Z',
  source:'espn-public-gamelog', eventStatus:'final',
  stats:{assists:7}, raw:{playerId:'player-11'}, ...edits,
});
test('ESPN archived game with explicit final status gets a labeled reference, not certified provenance',()=>{
  const x=normalizeStoredPlayerGames([row('401999001')],'player-11');
  assert.equal(x.games.length,1);
  assert.equal(x.games[0].sourceLinkType,'CONSTRUCTED_EVENT_REFERENCE');
  assert.equal(x.sourceAuthenticated,false);
  const evidence=reviewPlayerStreakEvidence({playerId:'player-11',games:x.games,stat:'assists',threshold:6,asOf:'2026-11-09T00:00:00Z'});
  assert.equal(evidence.verifiedGames,1);
  assert.equal(evidence.modelProbability,null);
  assert.equal(evidence.executableSelection,false);
});
test('missing final status, source, date, and mismatched player fail closed',()=>{
  const x=normalizeStoredPlayerGames([
    row('1',{eventStatus:null,raw:{playerId:'player-11'}}),
    row('2',{source:'unknown',raw:{}}),
    row('3',{statDate:'invalid'}),
    row('4',{athleteId:'another'}),
    row('5',{raw:{playerId:'another'}}),
  ],'player-11');
  assert.equal(x.games.length,0);
  assert.equal(x.omitted.length,5);
});
test('stored completion flag cannot override a scheduled event',()=>{
  const x=normalizeStoredPlayerGames([row('401999001',{eventStatus:'scheduled',raw:{playerId:'player-11',completed:true}})],'player-11');
  assert.equal(x.games.length,0);
  assert.ok(x.omitted[0].reasons.includes('FINAL_STATUS_UNVERIFIED'));
});
test('accepts provider source link only if https; rejects mismatched ESPN domain',()=>{
  const x=normalizeStoredPlayerGames([
    row('custom-1',{source:'provider-b',raw:{playerId:'player-11',sourceUrl:'https://provider.example/game/1'}}),
    row('custom-2',{raw:{playerId:'player-11',sourceUrl:'https://evil.example/game/1'}}),
  ],'player-11');
  assert.equal(x.games.length,1);
  assert.equal(x.games[0].sourceLinkType,'ARCHIVED_SOURCE_LINK');
  assert.equal(x.omitted.length,1);
});
test('rejects malformed batch',()=>{
  assert.throws(()=>normalizeStoredPlayerGames([],''),/INVALID_STORED_PLAYER_GAMES/);
});

test('normalizes known numeric ESPN stat abbreviations but not unrelated providers',()=>{
  const espn=normalizeStoredPlayerGames([row('401999001',{stats:{ast:8,pts:27,reb:11}})],'player-11');
  assert.equal(espn.games[0].stats.assists,8);
  assert.equal(espn.games[0].stats.points,27);
  assert.equal(espn.games[0].stats.rebounds,11);
  const other=normalizeStoredPlayerGames([row('custom-1',{
    source:'provider-b',stats:{ast:8},raw:{playerId:'player-11',sourceUrl:'https://provider.example/game/1'}
  })],'player-11');
  assert.equal(other.games[0].stats.assists,undefined);
});
