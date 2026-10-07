import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/lib/productionCertification.ts',import.meta.url),'utf8');

test('strict production certification is scoped to exact deployment provider evidence',()=>{
 assert.match(source,/providerCertificationRuntimeCommit\(\)/);
 assert.match(source,/latestProviderCertification\(deploymentCommit\|\|undefined\)/);
});

test('remediation continuity accepts exact normalized ODDS certification without weakening the ordinary strict gate',()=>{
 assert.match(source,/const normalizedOddsCertified=Boolean/);
 assert.match(source,/capability\|\|''\)===['"]ODDS['"]/);
 assert.match(source,/status\|\|''\)===['"]CERTIFIED['"]/);
 assert.match(source,/normalizedCount\|\|0\)>0/);
 assert.match(source,/const remediationContinuity=Boolean/);
 assert.match(source,/remediationMode&&readiness\.ready&&\(normalizedOddsCertified\|\|pulseContinuityEvidence\)/);
});

test('stored remediation slate requires exact live certification and non-rejected market quality',()=>{
 assert.match(source,/const storedRemediationContinuity=Boolean/);
 assert.match(source,/ingestion\.source===['"]stored['"]&&ingestion\.markets\.length>0&&dataQuality\.grade!==['"]REJECT['"]/);
 assert.match(source,/!storedRemediationContinuity&&!pulseOnlyContinuity/);
 assert.match(source,/comparative canary must prove no regression before promotion/);
});

test('known inherited automation and observability failures are warnings only inside bounded remediation continuity',()=>{
 assert.match(source,/strict&&remediationContinuity&&continuityAutomationFailures\.has\(jobName\)/);
 assert.match(source,/if\(strict&&remediationContinuity\)warnings\.push/);
 assert.match(source,/if\(strict&&remediationContinuity\)\{/);
});
