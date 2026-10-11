import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const writer=readFileSync(new URL('../src/lib/intelligence-core/warehouse.ts',import.meta.url),'utf8');
test('warehouse ingestion requires enabled registered provider identities',()=>{
 assert.match(writer,/where enabled=true/);
 assert.match(writer,/SOURCE_NOT_REGISTERED/);
 assert.doesNotMatch(writer,/insert into intelligence_sources/);
});
test('enforces bounded batches and immutable deduplicated rows',()=>{
 assert.match(writer,/MAX_BATCH=100/);
 assert.match(writer,/MAX_PAYLOAD_BYTES=32768/);
 assert.match(writer,/on conflict \(source_id,event_id,observation_kind,observed_at,payload_hash\)/);
});
test('coverage is based on upstream identities and freshness',()=>{
 assert.match(writer,/sourceCoverage\(sources\.map/);
 assert.match(writer,/classifyFreshness/);
});
