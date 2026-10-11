import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../src/lib/intelligence-core/execution.ts',import.meta.url),'utf8');
test('idempotent jobs and bounded claims',()=>{
 assert.match(code,/on conflict \(run_key\) do nothing/);
 assert.match(code,/for update skip locked/);
 assert.match(code,/attempt_count < 3/);
});
