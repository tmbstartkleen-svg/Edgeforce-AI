import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const persistence=readFileSync(new URL('../src/lib/persistence.ts',import.meta.url),'utf8');

test('V169 market persistence keeps EdgeForce id separate from provider event id',()=>{
 assert.match(persistence,/values\(\$\{m\.id\},\$\{m\.sourceEventId\|\|m\.id\}/);
 assert.match(persistence,/provider_event_id=excluded\.provider_event_id/);
 assert.match(persistence,/nullif\(coalesce\(ms\.raw->>'sourceEventId',e\.provider_event_id\),'\'\'\) as "sourceEventId"/);
});

test('V169 model-run evidence retains source event identity',()=>{
 assert.match(persistence,/sourceEventId:x\.sourceEventId\|\|null/);
});
