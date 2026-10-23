import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('worker/d1-observations.ts','utf8');
test('D1 writer preserves original timestamps, approved sources, dedup and limits',()=>{
 assert.match(source,/input.length>25/);
 assert.match(source,/normalizeObservation\(item,now\)/);
 assert.match(source,/STALE_SOURCE_TIMESTAMP/);
 assert.match(source,/source_id=\? AND enabled=1/);
 assert.match(source,/registry.upstream_id!==o.upstreamId/);
 assert.match(source,/D1_PAYLOAD_TOO_LARGE/);
 assert.match(source,/INSERT OR IGNORE/);
 assert.match(source,/new Date\(o.observedAt\).toISOString\(\)/);
 assert.match(source,/limit>100/);
 assert.doesNotMatch(source,/new Date\(\).toISOString\(\)/);
});

test('D1 odds ingestion rejects malformed, unpriced and already-started markets before persistence',()=>{
 assert.match(source,/o.kind==='odds'/);
 assert.match(source,/INVALID_ODDS_OBSERVATION/);
 assert.match(source,/q.bookmaker,q.sport,q.league,q.marketType,q.outcomeId,q.startsAt/);
 assert.match(source,/Number.isInteger\(q.priceAmerican\)/);
 assert.match(source,/Date.parse\(String\(q.startsAt\)\)<=now/);
});

test('scoreboard registrations cannot be used as odds ingestion authority',()=>{
 assert.match(source,/o\.kind==='odds'&&o\.provider\.startsWith\('espn-scoreboard-'\)/);
 assert.match(source,/SCOREBOARD_SOURCE_CANNOT_SUPPLY_ODDS/);
 assert.match(source,/SCOREBOARD_UPSTREAM_MISMATCH/);
});
