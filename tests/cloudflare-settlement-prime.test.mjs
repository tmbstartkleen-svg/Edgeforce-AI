import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../.github/workflows/deploy-cloudflare.yml',import.meta.url),'utf8');

test('V168 settlement prime runs before strict launch doctor',()=>{
 const prime=workflow.indexOf('Prime settlement automation health');
 const doctor=workflow.indexOf('Strict Cloudflare platform launch doctor');
 assert.ok(prime>=0);
 assert.ok(doctor>prime);
});

test('V168 settlement prime uses rotated cron secret and requires healthy payload',()=>{
 assert.match(workflow,/\/api\/cron\/settle/);
 assert.match(workflow,/Authorization: Bearer \$CRON_SECRET/);
 assert.match(workflow,/jq -e '\.ok==true'/);
 assert.match(workflow,/Settlement automation reported unhealthy after deployment/);
});

test('V168 settlement prime retries only bounded convergence statuses',()=>{
 assert.match(workflow,/for ATTEMPT in 1 2 3 4 5/);
 assert.match(workflow,/\[ "\$HTTP_CODE" = "401" \]/);
 assert.match(workflow,/\[ "\$HTTP_CODE" = "503" \]/);
 assert.match(workflow,/settlementNoop/);
 assert.match(workflow,/fallbackAvailable/);
});
