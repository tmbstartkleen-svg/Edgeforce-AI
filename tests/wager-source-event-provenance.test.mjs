import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const ledger=readFileSync(new URL('../src/lib/ledger.ts',import.meta.url),'utf8');
const history=readFileSync(new URL('../src/lib/betHistory.ts',import.meta.url),'utf8');
const fallback=readFileSync(new URL('../src/lib/scoreSettlementFallback.ts',import.meta.url),'utf8');

test('V170 wager input and historical legs expose source event identity separately',()=>{
 assert.match(ledger,/sourceEventId\?:string/);
 assert.match(history,/sourceEventId\?:string/);
 assert.match(ledger,/metadata->>'sourceEventId' as "sourceEventId"/);
});

test('V170 recordWager resolves provider event ids in one bounded batch',()=>{
 assert.match(ledger,/const internalEventIds=\[\.\.\.new Set\(input\.legs\.map\(x=>x\.eventId\)/);
 assert.match(ledger,/select id,provider_event_id as "providerEventId"/);
 assert.match(ledger,/jsonb_array_elements_text/);
 assert.match(ledger,/const sourceEventId=leg\.sourceEventId\|\|\(leg\.eventId\?providerEventIds\.get\(leg\.eventId\):undefined\)/);
});

test('V170 stores source identity in leg metadata and wager event evidence',()=>{
 assert.match(ledger,/sql\.json\(sourceEventId\?\{sourceEventId\}:\{\}\)/);
 assert.match(ledger,/sourceEventIds:\[\.\.\.new Set\(recordedSourceEventIds\)\]/);
});

test('V170 settlement prefers wager-frozen source identity over refreshed event mapping',()=>{
 assert.match(fallback,/coalesce\(bl\.metadata->>'sourceEventId',e\.provider_event_id\)/);
});
