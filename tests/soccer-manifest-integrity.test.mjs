import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soccerCandidates } from '../src/lib/intelligence-core/soccer-fixture-registry.mjs';

const manifest = JSON.parse(readFileSync(new URL('../config/soccer-coverage-targets.json', import.meta.url), 'utf8'));
const normalize = value => value.toLowerCase().replace(/^english /, '').replace(/[^a-z0-9]/g, '');

test('soccer coverage seed contains unique, nonempty league targets', () => {
  assert.ok(Array.isArray(manifest.draftKingsLeagueSeed));
  const targets = manifest.draftKingsLeagueSeed;
  assert.ok(targets.length >= 30);
  assert.ok(targets.every(x => typeof x === 'string' && x.trim()));
  assert.equal(new Set(targets.map(normalize)).size, targets.length);
  assert.match(manifest.coverageDisclaimer, /not an exhaustive/i);
});

test('soccer candidate IDs, codes and normalized league names remain unique', () => {
  const unique = key => new Set(soccerCandidates.map(key)).size === soccerCandidates.length;
  assert.ok(unique(x => x.id));
  assert.ok(unique(x => x.code));
  assert.ok(unique(x => normalize(x.league)));
  assert.ok(soccerCandidates.every(x => x.id.startsWith('soccer-') && x.code && x.league));
});

test('candidate fixtures remain separate from licensed DraftKings inventory', () => {
  assert.match(manifest.target, /DraftKings/);
  assert.match(manifest.coverageDisclaimer, /partial seed/i);
  assert.ok(!Object.hasOwn(manifest, 'licensedOddsVerified'));
});
