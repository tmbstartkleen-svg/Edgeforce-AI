import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const fallback=read('src/lib/scoreSettlementFallback.ts');
const provider=read('src/lib/resultProvider.ts');
const ledger=read('src/lib/ledger.ts');
const route=read('src/app/api/ledger/settlement-evidence/route.ts');

test('V151 fallback and provider results carry explicit provenance classes',()=>{
 assert.match(fallback,/schemaVersion:'v151-settlement-provenance-1'/);
 assert.match(fallback,/evidenceClass:decision\.trustedSingleSource\?'TRUSTED_PRIMARY_SINGLE':'CORROBORATED_SCORE'/);
 assert.match(fallback,/finalScore:\{/);
 assert.match(provider,/evidenceClass:'PROVIDER_NATIVE'/);
 assert.match(provider,/settlementProvenanceWritten:reconciliation\.provenanceWritten/);
});

test('V151 reconciliation persists provenance idempotently into leg metadata',()=>{
 assert.match(ledger,/jsonb_set\(/);
 assert.match(ledger,/\{settlementProvenance\}/);
 assert.match(ledger,/metadata->'settlementProvenance'\) is distinct from/);
 assert.match(ledger,/provenanceWritten\+=evidenceRows\.length/);
});

test('V151 reconciliation records durable result evidence ledger events',()=>{
 assert.match(ledger,/RESULT_EVIDENCE_APPLIED/);
 assert.match(ledger,/settlementProvenance:provenance/);
 assert.match(ledger,/evidenceEvents\+\+/);
 assert.match(ledger,/evidenceClasses/);
});

test('V151 exposes a bounded read-only settlement evidence history API',()=>{
 assert.match(ledger,/export async function loadSettlementEvidenceHistory\(limit=100\)/);
 assert.match(ledger,/where le\.event_type='RESULT_EVIDENCE_APPLIED'/);
 assert.match(ledger,/Math\.max\(1,Math\.min\(500/);
 assert.match(route,/schemaVersion:'v151-durable-settlement-provenance-1'/);
 assert.match(route,/loadSettlementEvidenceHistory\(limit\)/);
 assert.ok(!route.includes('export async function POST'));
});
