import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const auth=fs.readFileSync(new URL('../src/lib/providers/kalshi-readonly-auth.ts',import.meta.url),'utf8');
const provider=fs.readFileSync(new URL('../src/lib/providers/kalshi.ts',import.meta.url),'utf8');
test('Kalshi signed requests use RSA-PSS SHA256 GET path without query',()=>{
 assert.match(auth,/RSA_PKCS1_PSS_PADDING/);
 assert.match(auth,/saltLength:32/);
 assert.match(auth,/timestamp\+'GET'\+url\.pathname/);
 assert.match(auth,/external-api\.kalshi\.com/);
});
test('Kalshi auth is opt-in, read-only, and fails closed for partial credentials',()=>{
 assert.match(provider,/Boolean\(keyId\)!==Boolean\(privateKey\)/);
 assert.match(provider,/kalshiReadOnlyHeaders\(url,keyId,privateKey\)/);
 assert.match(provider,/headers:\{Accept:'application\/json',\.\.\.authHeaders\}/);
 assert.doesNotMatch(auth,/\bPOST\b|\bDELETE\b/);
});
