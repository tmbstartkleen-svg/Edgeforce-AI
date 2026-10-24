import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/app/api/operations/odds-configuration-readiness/route.ts',import.meta.url),'utf8');
test('diagnostic endpoint requires CRON_SECRET and bearer auth',()=>{assert.match(source,/process\.env\.CRON_SECRET/);assert.match(source,/UNAUTHORIZED/)});
test('diagnostic endpoint never calls providers or reveals secret values',()=>{assert.match(source,/apiKeyPresent:Boolean\(p\.apiKey\)/);assert.doesNotMatch(source,/fetch\(/);assert.match(source,/apiRequestsMade:0/)});
test('configuration is not misrepresented as live odds verification',()=>{assert.match(source,/liveOddsObserved:false/);assert.match(source,/draftKingsQuotesVerified:false/);assert.match(source,/independentUpstreamsVerified:0/)});
