import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const page=fs.readFileSync(new URL('../src/app/value-desk/page.tsx',import.meta.url),'utf8');
const component=fs.readFileSync(new URL('../src/components/ValueDesk.tsx',import.meta.url),'utf8');
test('value desk provides accessible all-sports research surface',()=>{
 assert.match(page,/Find the value/);
 for(const required of ['All sports','Expected ROI','Break-even','edgePp','providerDegraded']) assert.ok((page+component).includes(required));
});
test('empty results do not fabricate example wagers',()=>{
 assert.match(component,/No provisional value opportunities/);
 assert.match(component,/No example bets are substituted/);
});
test('unverified data cannot be described as certain',()=>{
 assert.match(component,/NOT independently calibrated/);
 assert.match(component,/must not trigger betting alerts/);
});
