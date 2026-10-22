import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync('scripts/certify-isolated-coverage-matrix.mjs','utf8');
test('coverage certification enforces authenticated read-only cross-check of all sources',()=>{
 for(const k of ['score-collector-readiness','score-coverage-matrix?hours=168','score-history-audit?hours=168','COVERAGE_TOTALS_DISAGREE','COVERAGE_SOURCE_DISAGREEMENT','UNVERIFIED_MARKET_EVIDENCE','collectionEnabled:false','d1WriteEnabled:false'])
  assert.ok(s.includes(k),k);
 assert.doesNotMatch(s,/INSERT INTO|DELETE FROM|UPDATE intelligence|method:'POST'|wrangler deploy/);
});
