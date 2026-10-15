import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const code=readFileSync('worker/d1-reference-adapters.ts','utf8');
for(const name of ['upsertTeam','getTeam','upsertAthlete','getAthlete','upsertEvent','getEvent'])test(name+' is provided as a bounded D1 adapter',()=>assert.match(code,new RegExp('export async function '+name+'\\(')));
test('all writes use bound values and idempotent upserts',()=>{assert.equal((code.match(/ON CONFLICT\(id\) DO UPDATE SET/g)||[]).length,3);assert.equal((code.match(/\.bind\(/g)||[]).length,6);assert.doesNotMatch(code,/DELETE FROM|DROP TABLE|TRUNCATE/i);});
test('adapter remains isolated from PostgreSQL production queries',()=>{assert.doesNotMatch(readFileSync('src/lib/db.ts','utf8'),/d1-reference-adapters/);assert.doesNotMatch(readFileSync('worker/index.ts','utf8'),/upsertTeam|upsertAthlete|upsertEvent/);});
