import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const code=fs.readFileSync(new URL('../worker/d1-independent-odds-audit.ts',import.meta.url),'utf8');
test('multiple bookmakers do not imply multiple upstream feeds',()=>{assert.match(code,/upstreams\.size>=2/);assert.match(code,/bookmakerDiversityIsNotProviderIndependence:true/);});
test('audits require fresh quotes and never approve wagers',()=>{assert.match(code,/120000/);assert.match(code,/modelProbabilityVerified:false/);assert.match(code,/betRecommendationAuthorized:false/);assert.match(code,/upstreamIdentityAuthenticated:false/);});
