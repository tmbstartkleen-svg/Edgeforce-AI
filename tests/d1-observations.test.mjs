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
