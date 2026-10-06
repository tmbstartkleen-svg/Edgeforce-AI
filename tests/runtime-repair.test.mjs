import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import {evaluateReleaseGate} from '../scripts/release-gate.mjs';

const ts = createRequire(import.meta.url)('typescript');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return {promise, resolve};
};
function context() {
  const tasks = [];
  return {
    tasks,
    waitUntil(task) { tasks.push(Promise.resolve(task)); },
    async drain() {
      const results = [];
      for (let index = 0; index < tasks.length;) {
        const batch = tasks.slice(index);
        index = tasks.length;
        results.push(...await Promise.allSettled(batch));
      }
      return results;
    },
  };
}

let fixtureId = 0;
async function databaseFixture() {
  const clients = [];
  const factory = (url, options) => {
    if (url === 'throw-init') throw new Error('fixture initialization failed');
    const sql = async () => {
      assert.equal(sql.closed, false, 'queries cannot run on a closed pool');
      return [{ok: 1}];
    };
    Object.assign(sql, {url, options, closed: false, closeCalls: 0});
    sql.end = async () => { sql.closed = true; sql.closeCalls++; };
    clients.push(sql);
    return sql;
  };
  const key = `edgeforce.db.test.${++fixtureId}`;
  globalThis[Symbol.for(key)] = factory;
  const source = readFileSync(new URL('../src/lib/db.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022},
    reportDiagnostics: true,
  });
  assert.equal(compiled.diagnostics.length, 0);
  const replacement = `const postgres = globalThis[Symbol.for(${JSON.stringify(key)})];`;
  const code = compiled.outputText.replace(/import postgres from ['"]postgres['"];?/, replacement);
  assert.ok(code.includes(replacement), 'fixture must replace the actual postgres import');
  const runtime = await import(`data:text/javascript,${encodeURIComponent(code)}`);
  delete globalThis[Symbol.for(key)];
  return {...runtime, clients};
}
const env = {DATABASE_URL: 'postgres://fixture-only', DEPLOYMENT_PLATFORM: 'cloudflare'};

test('same Worker request reuses one bounded pool; later requests never reuse it', async () => {
  const d = await databaseFixture();
  for (let i = 0; i < 3; i++) {
    const ctx = context();
    await d.withDatabaseScope(async () => {
      assert.equal(d.db(), d.db());
      assert.equal(d.db().options.max, 2);
      assert.deepEqual(await d.dbHealth(), {configured: true, ok: true});
    }, env, ctx);
    await ctx.drain();
    assert.equal(d.clients.length, i + 1);
    assert.equal(d.clients[i].closed, true);
    assert.equal(d.clients[i].closeCalls, 1);
  }
});

test('overlapping requests isolate pools through asynchronous continuations', async () => {
  const d = await databaseFixture();
  const contexts = [context(), context()];
  const release = deferred();
  const seen = [];
  await Promise.all(contexts.map((ctx, index) => d.withDatabaseScope(async () => {
    const sql = d.db();
    seen[index] = sql;
    if (index === 1) release.resolve();
    await release.promise;
    await tick();
    assert.equal(d.db(), sql);
  }, env, ctx)));
  await Promise.all(contexts.map(ctx => ctx.drain()));
  assert.notEqual(seen[0], seen[1]);
  assert.ok(seen.every(sql => sql.closed && sql.closeCalls === 1));
});

test('pool survives response streaming and closes after the body is consumed', async () => {
  const d = await databaseFixture();
  const ctx = context(), release = deferred();
  let sql;
  const response = await d.withDatabaseScope(async () => {
    sql = d.db();
    return new Response(new ReadableStream({
      async start(controller) {
        await release.promise;
        assert.equal(d.db(), sql);
        await d.db()`select 1`;
        controller.enqueue(new TextEncoder().encode('streamed'));
        controller.close();
      },
    }), {headers: {'x-test': 'preserved'}});
  }, env, ctx);
  assert.equal(sql.closed, false);
  assert.equal(response.headers.get('x-test'), 'preserved');
  release.resolve();
  assert.equal(await response.text(), 'streamed');
  await ctx.drain();
  assert.equal(sql.closed, true);
});

test('response cancellation propagates and releases the request pool', async () => {
  const d = await databaseFixture();
  const ctx = context();
  let cancelled = false;
  const response = await d.withDatabaseScope(async () => {
    d.db();
    return new Response(new ReadableStream({cancel() { cancelled = true; }}));
  }, env, ctx);
  await response.body.cancel('client disconnected');
  await ctx.drain();
  assert.equal(cancelled, true);
  assert.equal(d.clients[0].closed, true);
});

test('waitUntil and nested background work finish before pool cleanup', async () => {
  const d = await databaseFixture();
  const ctx = context(), first = deferred(), second = deferred();
  await d.withDatabaseScope(async scoped => {
    const sql = d.db();
    scoped.waitUntil((async () => {
      await first.promise;
      scoped.waitUntil((async () => {
        await second.promise;
        assert.equal(d.db(), sql);
        await d.db()`select 1`;
      })());
    })());
  }, env, ctx);
  first.resolve();
  await tick();
  assert.equal(d.clients[0].closed, false);
  second.resolve();
  await ctx.drain();
  assert.equal(d.clients[0].closeCalls, 1);
});

test('handler exceptions still clean up without masking the original error', async () => {
  const d = await databaseFixture();
  const ctx = context();
  await assert.rejects(d.withDatabaseScope(async () => {
    d.db();
    throw new Error('handler failure');
  }, env, ctx), /handler failure/);
  await ctx.drain();
  assert.equal(d.clients[0].closed, true);
});

test('request bindings, absent credentials and init failures never leak between scopes', async () => {
  const d = await databaseFixture();
  for (const [bindings, expected] of [
    [{DATABASE_URL: 'throw-init'}, {configured: true, ok: false, error: 'fixture initialization failed'}],
    [{}, {configured: false, ok: false}],
    [{NEON_DATABASE_URL: 'postgres://second-fixture'}, {configured: true, ok: true}],
  ]) {
    const ctx = context();
    await d.withDatabaseScope(async () => assert.deepEqual(await d.dbHealth(), expected), bindings, ctx);
    await ctx.drain();
  }
  assert.equal(d.clients.length, 1);
  assert.equal(d.clients[0].url, 'postgres://second-fixture');
});

test('Node keeps its pool while unscoped Cloudflare access fails closed', async () => {
  const d = await databaseFixture();
  const oldUrl = process.env.DATABASE_URL, oldPlatform = process.env.DEPLOYMENT_PLATFORM;
  try {
    process.env.DATABASE_URL = 'postgres://node-fixture';
    process.env.DEPLOYMENT_PLATFORM = 'vercel';
    const sql = d.db();
    assert.equal(d.db(), sql);
    assert.equal(sql.options.max, 4);
    assert.equal(sql.closed, false);
    process.env.DEPLOYMENT_PLATFORM = 'cloudflare';
    assert.throws(() => d.db(), /requires a request scope/);
    assert.equal((await d.dbHealth()).ok, false);
    assert.equal(d.clients.length, 1);
  } finally {
    if (oldUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = oldUrl;
    if (oldPlatform === undefined) delete process.env.DEPLOYMENT_PLATFORM; else process.env.DEPLOYMENT_PLATFORM = oldPlatform;
  }
});

const canary = {schemaVersion: 'v73-deployment-guard-1', ok: true, decision: 'PASS', hardBlock: false, blockers: []};
const slo = {schemaVersion: 'v74-slo-governor-1', ok: true, deploymentAllowed: true, state: 'OPEN', current: {overall: 'HEALTHY', actionIncidents: 0}};

test('valid canary PASS preserves literal hardBlock=false', () => {
  assert.equal(evaluateReleaseGate('canary', canary), 'PASS');
  assert.equal(evaluateReleaseGate('canary', {...canary, ok: false, decision: 'BLOCK', blockers: ['temporary regression']}), 'HOLD');
});

test('canary missing/string hardBlock, hard failures and noisy JSON cannot pass', () => {
  for (const hardBlock of [undefined, null, 'false', true]) {
    assert.throws(() => evaluateReleaseGate('canary', {...canary, hardBlock}));
  }
  assert.throws(() => JSON.parse(`Vercel CLI 62.2.0\n${JSON.stringify(canary)}`));
  assert.throws(() => evaluateReleaseGate('canary', {}));
  assert.equal(evaluateReleaseGate('canary', {...canary, blockers: ['still blocked']}), 'HOLD');
});

test('SLO payload decides the gate even when a CLI transport exits zero', () => {
  assert.equal(evaluateReleaseGate('slo', slo), 'SLO_BUDGET_PASSED');
  const frozen = {...slo, ok: false, deploymentAllowed: false, state: 'FROZEN'};
  assert.throws(() => evaluateReleaseGate('slo', frozen));
  assert.equal(evaluateReleaseGate('slo', frozen, {remediation: true}), 'SLO_REMEDIATION_ACCEPTED');
  assert.throws(() => evaluateReleaseGate('slo', {...frozen, current: {overall: 'CRITICAL', actionIncidents: 3}}, {remediation: true}));
  assert.throws(() => evaluateReleaseGate('slo', {...frozen, current: {overall: 'HEALTHY'}}, {remediation: true}));
  assert.throws(() => evaluateReleaseGate('slo', {ok: false, error: 'database unavailable'}, {remediation: true}));
});

test('strict V1 NO_GO, required failures and missing evidence stay blocked', () => {
  const v1 = {ok: true, strict: true, verdict: 'CONDITIONAL', blockers: [], gates: [{required: true, state: 'PASS'}]};
  assert.equal(evaluateReleaseGate('v1', v1), 'CONDITIONAL');
  for (const invalid of [
    {...v1, ok: false, verdict: 'NO_GO'}, {...v1, blockers: ['ACTION incident']},
    {...v1, gates: []}, {...v1, strict: false}, {...v1, gates: [{required: true, state: 'FAIL'}]},
  ]) assert.throws(() => evaluateReleaseGate('v1', invalid));
});
