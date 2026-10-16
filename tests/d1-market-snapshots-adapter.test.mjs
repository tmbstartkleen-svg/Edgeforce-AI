import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const src=fs.readFileSync('worker/d1-market-snapshots.ts','utf8');
test('market snapshot writes require proven provider and bound parameters',()=>{
 assert.match(src,/export async function insertMarketSnapshot/);assert.match(src,/required\(row.provider,'PROVIDER'\)/);
 assert.match(src,/\.bind\(required\(row.event_id/);assert.match(src,/INVALID_AMERICAN_ODDS/);
 assert.doesNotMatch(src,/DELETE FROM|DROP TABLE|TRUNCATE/i);
});
test('bounded event scoped reads retain sportsbook provenance',()=>{assert.match(src,/WHERE event_id=\? ORDER BY pulled_at DESC,id DESC LIMIT \?/);assert.match(src,/provider,bookmaker,market_key,selection_key/);assert.match(src,/limit>100/);});
test('not activated in production Worker',()=>{assert.doesNotMatch(fs.readFileSync('worker/index.ts','utf8'),/d1-market-snapshots/);});
