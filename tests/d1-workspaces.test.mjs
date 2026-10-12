import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync('worker/d1-workspaces.ts','utf8');
const routes=readFileSync('worker/d1-standalone.ts','utf8');
test('public workspace is aggregate-only and excludes synthetic source',()=>{
 assert.match(code,/source_id != 'edgeforce-d1-certification'/);
 assert.match(code,/actualLiveCoverageCertified:false/);
 assert.match(code,/nonSportsContractCount:null/);
 assert.doesNotMatch(code,/SELECT \*/);
 assert.match(routes,/\/api\/intelligence\/workspaces\/summary/);
});
