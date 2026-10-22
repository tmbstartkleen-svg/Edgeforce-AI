import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync('scripts/certify-isolated-score-history.mjs','utf8');
test('phase 2 history certification is read-only and fail-closed',()=>{
 for(const v of ['score-collector-readiness','score-history-audit?hours=168','SOURCE_REGISTRATION_INCOMPLETE','STAGING_FLAGS_NOT_DISABLED','HISTORICAL_NHL_RECEIPT_NOT_VISIBLE','HISTORY_TOTAL_MISMATCH','oddsCertified:false'])assert.ok(s.includes(v),v);
 assert.doesNotMatch(s,/method:'POST'|INSERT INTO|wrangler deploy|SPORTS_SCORE_COLLECT_ENABLED='true'/);
});
