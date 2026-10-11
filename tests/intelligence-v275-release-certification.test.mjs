import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const yaml=readFileSync(new URL('../.github/workflows/deploy-cloudflare.yml',import.meta.url),'utf8');
test('deployed warehouse audits run after Worker release identity',()=>{
 const identity=yaml.indexOf('Wait for exact Worker release identity');
 const audit=yaml.indexOf('Audit deployed Intelligence Core warehouse and provider evidence');
 const provider=yaml.indexOf('Certify recommendation data without blocking platform launch');
 assert.ok(identity>=0&&audit>identity&&provider>audit);
});
test('audits are authenticated and never write to the warehouse',()=>{
 const begin=yaml.indexOf('Audit deployed Intelligence Core warehouse and provider evidence');
 const end=yaml.indexOf('Certify recommendation data without blocking platform launch',begin);
 const snippet=yaml.slice(begin,end);
 assert.match(snippet,/Authorization: Bearer \$CRON_SECRET/);
 assert.match(snippet,/intelligence-core\/readiness/);
 assert.match(snippet,/intelligence-core\/providers/);
 assert.doesNotMatch(snippet,/curl[^\n]*(-X POST|--request POST)/);
 assert.match(snippet,/GITHUB_STEP_SUMMARY/);
});
