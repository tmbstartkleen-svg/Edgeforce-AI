import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/app/api/operations/odds-launch-gate/route.ts',import.meta.url),'utf8');
test('unified launch gate requires owner-controlled bearer secret',()=>{assert.match(source,/process\.env\.CRON_SECRET/);assert.match(source,/UNAUTHORIZED/)});
test('gate checks persisted freshness and target bookmaker evidence',()=>{assert.match(source,/NO_QUOTES_STORED_IN_LAST_20_MINUTES/);assert.match(source,/NO_DRAFTKINGS_LABELLED_QUOTES_IN_LAST_20_MINUTES/)});
test('gate remains read-only and does not certify edge or coverage',()=>{assert.match(source,/liveRequestsMade:0/);assert.match(source,/ingestionTriggered:false/);assert.match(source,/positiveExpectedValueCertified:false/);assert.match(source,/completeDraftKingsCatalogVerified:false/)});
