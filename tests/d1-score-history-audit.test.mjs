import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync('worker/d1-score-history-audit.ts','utf8');
const route=readFileSync('worker/d1-standalone.ts','utf8');
test('score history is auth-gated, read-only and uses isolated D1 scoreboard observations',()=>{
 assert.match(route,/score-history-audit/);
 for(const term of ['UNAUTHORIZED','D1_BINDING_MISSING','SPORT_NOT_APPROVED','INVALID_HISTORY_WINDOW','READ_ONLY_SCORE_HISTORY_AUDIT','SCORES_NOT_ODDS'])assert.ok(src.includes(term),term);
 assert.match(src,/observation_kind='score'/);
 assert.match(src,/ingested_at>=\?/);
 assert.match(src,/COUNT\(DISTINCT event_id\)/);
 assert.doesNotMatch(src,/INSERT INTO|DELETE FROM|UPDATE intelligence|fetch\(/);
});
test('audit refuses to misrepresent unverified market and modeling coverage',()=>{
 for(const term of ['oddsCertified:false','playerStatsCertified:false','predictionsCertified:false','actualPersistedEvidence'])assert.ok(src.includes(term),term);
 assert.match(src,/hours>720/);
 assert.match(src,/scoreSports\.map/);
});
