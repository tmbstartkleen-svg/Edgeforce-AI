import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ingest=read('src/lib/providers/ingest.ts');
const consensus=read('src/lib/marketConsensus.ts');
const persistence=read('src/lib/persistence.ts');
test('archive receives original bookmaker panel, not blended displayed quote',()=>{
 assert.match(ingest,/saveMarketSnapshots\(live\.panelMarkets\|\|\[\]/);
 assert.doesNotMatch(ingest,/saveMarketSnapshots\(live\.markets,/);
});
test('consensus missing target book retains actual reference source and explicit missing target marker',()=>{
 assert.match(consensus,/targetBookFound:Boolean\(exactTarget\)/);
 assert.match(consensus,/sourceBook:target\.sourceBook\|\|target\.sourceProviderId/);
 assert.doesNotMatch(consensus,/sourceBook:target\.sourceBook\|\|targetBook/);
});
test('storage independently partitions each provider bookmaker combination',()=>{
 assert.match(persistence,/distinct on \(ms\.event_id,ms\.market_key,ms\.selection_key,ms\.bookmaker,ms\.provider\)/);
});
