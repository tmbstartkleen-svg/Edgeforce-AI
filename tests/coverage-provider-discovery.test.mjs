import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/coverage-provider-discovery.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {normalizeProviderCatalog}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const base={provider:'authorized-feed',fetchedAt:'2026-10-21T12:00:00Z',events:[{id:'event-1',sport:'Soccer',league:'EPL',startsAt:'2026-10-22T12:00:00Z',markets:[{type:'moneyline',outcomes:[{id:'home',bookmakers:[{name:'DraftKings',americanOdds:-120},{name:'FanDuel',americanOdds:-110}]}]}]}]};
test('discovers only explicitly quoted target-book outcomes',()=>{const b=normalizeProviderCatalog(base);assert.equal(b.observations.length,1);assert.equal(b.observations[0].priceAmerican,-120);assert.equal(b.expected.length,1)});
test('unpriced target inventory is marked expected but not quoted',()=>{const c=structuredClone(base);c.events[0].markets[0].outcomes[0].bookmakers=[{name:'DraftKings'}];const b=normalizeProviderCatalog(c);assert.equal(b.expected.length,1);assert.equal(b.observations.length,0)});
test('provider-only other book never masquerades as DraftKings coverage',()=>{const c=structuredClone(base);c.events[0].markets[0].outcomes[0].bookmakers=[{name:'FanDuel',americanOdds:-110}];const b=normalizeProviderCatalog(c);assert.equal(b.expected.length,0);assert.equal(b.observations.length,0)});
test('malformed provider event does not generate market coverage',()=>{const c=structuredClone(base);c.events[0].startsAt='bad';assert.throws(()=>normalizeProviderCatalog(c),/INVALID_CATALOG_EVENT/)});
