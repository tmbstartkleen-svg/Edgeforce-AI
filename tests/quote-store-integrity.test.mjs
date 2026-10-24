import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const persistence=readFileSync(new URL('../src/lib/persistence.ts',import.meta.url),'utf8');
const ingest=readFileSync(new URL('../src/lib/providers/ingest.ts',import.meta.url),'utf8');
test('persisted quotes are distinct across bookmakers and independent provider labels',()=>{
 assert.match(persistence,/distinct on \(ms\.event_id,ms\.market_key,ms\.selection_key,ms\.bookmaker,ms\.provider\)/);
 assert.match(persistence,/order by ms\.event_id,ms\.market_key,ms\.selection_key,ms\.bookmaker,ms\.provider,ms\.pulled_at desc/);
});
test('stored quote age includes provider observation age, not merely time since database insertion',()=>{
 assert.match(persistence,/ms\.source_age_seconds/);
 assert.match(persistence,/nullif\(ms\.raw->>'sourceTimestamp',''\) as "sourceTimestamp"/);
});
test('source ages of unknown or invalid freshness cannot be stored as real quoted prices',()=>{
 assert.match(persistence,/!Number\.isFinite\(m\.sourceAgeMin\)/);
 assert.match(ingest,/stored\.filter\(x=>Number\.isFinite\(x\.sourceAgeMin\)\)/);
 assert.doesNotMatch(ingest,/Number\(x\.sourceAgeMin\)\|\|0/);
});
test('production never serves demo odds even when demo env flag is set',()=>{
 assert.match(ingest,/const allowDemo=!production/);
 assert.doesNotMatch(ingest,/ALLOW_DEMO_DATA==='true'\|\|!production/);
});

test('release certification checks explicit production-only ban rather than legacy demo setting',()=>{
 const releaseAudit=readFileSync(new URL('../scripts/release-audit.mjs',import.meta.url),'utf8');
 assert.match(releaseAudit,/production ingestion rejects demo fallback/);
 assert.match(releaseAudit,/const allowDemo=!production/);
});
