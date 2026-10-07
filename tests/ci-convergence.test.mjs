import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const verify=read('.github/workflows/verify.yml');
const cloudflare=read('.github/workflows/verify-cloudflare.yml');
const preview=read('.github/workflows/preview-cloudflare.yml');
const production=read('.github/workflows/deploy-cloudflare.yml');

const CHECKOUT='actions/checkout@11d5960a326750d5838078e36cf38b85af677262';
const SETUP='actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020';
const UPLOAD='actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02';

test('V149 PR workflows cancel superseded runs by stable workflow and PR identity',()=>{
 assert.match(verify,/group: edgeforce-verify-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}/);
 assert.match(cloudflare,/group: edgeforce-verify-cloudflare-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}/);
 assert.match(preview,/group: edgeforce-preview-cloudflare-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}/);
 for(const source of [verify,cloudflare,preview])assert.match(source,/cancel-in-progress: true/);
});

test('V149 validation jobs are bounded and deterministic',()=>{
 assert.match(verify,/build-and-smoke:\n\s+runs-on: ubuntu-latest\n\s+timeout-minutes: 30/);
 assert.match(cloudflare,/vinext-workers:\n\s+runs-on: ubuntu-latest\n\s+timeout-minutes: 25/);
 assert.match(preview,/preview:\n[\s\S]*?runs-on: ubuntu-latest\n\s+timeout-minutes: 25/);
 assert.match(preview,/cleanup:\n[\s\S]*?runs-on: ubuntu-latest\n\s+timeout-minutes: 10/);
 for(const source of [verify,cloudflare,preview]){
  assert.ok(source.includes('cache: npm'));
  assert.ok(source.includes('cache-dependency-path: package-lock.json'));
  assert.ok(source.includes('npm ci'));
  assert.ok(!source.includes('npm install'));
 }
});

test('V149 CI actions are pinned to reviewed immutable revisions',()=>{
 for(const source of [verify,cloudflare,preview]){
  assert.ok(source.includes(CHECKOUT));
  assert.ok(source.includes(SETUP));
  assert.ok(!source.includes('actions/checkout@v4'));
  assert.ok(!source.includes('actions/setup-node@v4'));
 }
 assert.ok(verify.includes(UPLOAD));
 assert.ok(cloudflare.includes(UPLOAD));
 assert.ok(preview.includes(UPLOAD));
});

test('V149 preserves production release serialization',()=>{
 assert.match(production,/group: edgeforce-cloudflare-production/);
 assert.match(production,/cancel-in-progress: false/);
 assert.ok(production.includes('Reject a superseded production commit'));
});
