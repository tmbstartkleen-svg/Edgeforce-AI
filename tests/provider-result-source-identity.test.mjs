import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const ledger=readFileSync(new URL('../src/lib/ledger.ts',import.meta.url),'utf8');

test('V171 provider-native result reconciliation accepts three bounded identity paths',()=>{
 assert.match(ledger,/bl\.event_id=\$\{result\.eventId\}/);
 assert.match(ledger,/nullif\(bl\.metadata->>'sourceEventId',''\)=\$\{result\.eventId\}/);
 assert.match(ledger,/e\.provider_event_id,''\)=\$\{result\.eventId\}/);
});

test('V171 source identity never replaces selection and market checks',()=>{
 const start=ledger.indexOf('export async function reconcileLedgerResults');
 const body=ledger.slice(start);
 assert.match(body,/lower\(bl\.selection\)=lower\(\$\{result\.selectionKey\}\)/);
 assert.match(body,/lower\(bl\.market_type\)=lower\(\$\{result\.marketKey\?\?''\}\)/);
});

test('V171 reconciliation reports which identity path matched',()=>{
 assert.match(ledger,/internalIdentityMatches\+\+/);
 assert.match(ledger,/frozenSourceIdentityMatches\+\+/);
 assert.match(ledger,/mappedSourceIdentityMatches\+\+/);
 assert.match(ledger,/INTERNAL_EVENT_ID/);
 assert.match(ledger,/FROZEN_SOURCE_EVENT_ID/);
 assert.match(ledger,/EVENT_PROVIDER_MAPPING/);
});

test('V171 durable result evidence distinguishes ledger and provider event ids',()=>{
 assert.match(ledger,/eventId:String\(row\.ledgerEventId\|\|result\.eventId\)/);
 assert.match(ledger,/resultEventId:String\(result\.eventId\)/);
 assert.match(ledger,/sourceEventId:row\.sourceEventId\?String\(row\.sourceEventId\):null/);
});
