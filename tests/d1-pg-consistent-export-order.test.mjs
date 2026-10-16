import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const s=readFileSync('scripts/d1-pg-consistent-export.mjs','utf8');
test('snapshot ordering does not assume legacy tables share an id column',()=>{assert.match(s,/ORDER BY to_jsonb\(t\)::text LIMIT 10001/);assert.doesNotMatch(s,/ORDER BY id LIMIT/);});
test('source export remains single-transaction and read-only',()=>{assert.match(s,/read only isolation level repeatable read/);assert.match(s,/ROW_LIMIT_EXCEEDED/);assert.match(s,/cutoverAuthorized:false/);});
