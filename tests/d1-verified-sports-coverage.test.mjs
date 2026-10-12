import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('worker/d1-sports-coverage.ts','utf8');
test('coverage counts only D1 registered, active, upstream-matched source observations',()=>{
 assert.match(source,/INNER JOIN intelligence_sources s/);
 assert.match(source,/s\.source_id=m\.source_id AND s\.upstream_id=m\.upstream_id AND s\.enabled=1/);
 assert.match(source,/age>=0&&age<=15/);
 assert.match(source,/registeredSourceOnly:true/);
 assert.match(source,/sourceIndependenceCertified:false/);
 assert.match(source,/providerLicenseCertified:false/);
 assert.match(source,/historicalNeonParityCertified:false/);
});
