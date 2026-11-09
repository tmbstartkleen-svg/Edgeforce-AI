import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import {
  connectionConfiguration, prepareUSCombo, createUSCombo,
  retailAuthHeaders, checkUSConnection, polymarketUSSlipGateway,
} from '../src/lib/intelligence-core/polymarket-us-slips.mjs';

const now = Date.parse('2026-11-09T17:00:00Z');
const choices = [
  { eventSlug: 'game-a', marketSlug: 'winner-a', outcomeId: '101' },
  { eventSlug: 'game-b', marketSlug: 'over-44pt5', outcomeId: '202' },
];
const event = (i = 0) => ({
  slug: choices[i].eventSlug, title: `Game ${i}`, active: true, closed: false,
  markets: [{ slug: choices[i].marketSlug, question: i ? 'Over 44.5' : 'Team A wins',
    active: true, closed: false, status: 'MARKET_STATUS_OPEN', comboEnabled: true,
    gameStartTime: '2026-11-10T01:15:00Z', line: i ? 44.5 : null,
    marketSides: [{ id: choices[i].outcomeId, identifier: choices[i].marketSlug,
      description: i ? 'Under' : 'Team A', long: !i, tradable: true, price: '0.55' }] }],
});
const response = data => Response.json(data);
const mockEvents = (change = () => {}) => async url => {
  const i = String(url).endsWith('/game-b') ? 1 : 0;
  const e = event(i); change(e, i);
  return response({ event: e });
};
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const seed = privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32);
const env = { POLYMARKET_US_KEY_ID: 'test-only-id', POLYMARKET_US_SECRET_KEY: seed.toString('base64'),
  POLYMARKET_US_COMBOS_ENABLED: 'true', CRON_SECRET: 'test-operator-secret-with-more-than-32-characters' };

test('uses Worker-supported manual redirects and rejects redirects without forwarding credentials', async () => {
  let calls = 0;
  await assert.rejects(checkUSConnection(env, { now, fetchImpl: async (url, options) => {
    calls++;
    assert.equal(options.redirect, 'manual');
    return new Response(null, { status: 302, headers: { location: 'https://untrusted.invalid/' } });
  } }), /POLYMARKET_US_REQUEST_REJECTED/);
  assert.equal(calls, 1);
});

test('resolves the requested short outcome explicitly and never invents an app slip URL', async () => {
  const p = await prepareUSCombo(choices, { now, fetchImpl: mockEvents() });
  assert.deepEqual(p.requestBody.legs, [
    { symbol: 'winner-a', side: 'SIDE_BUY' },
    { symbol: 'over-44pt5', side: 'SIDE_SELL' },
  ]);
  assert.equal(p.legs[1].selection, 'Under');
  assert.equal(p.legs[1].linkKind, 'EVENT_NAVIGATION_ONLY');
  assert.equal(p.appUrl, null);
  assert.equal(p.appPreloadVerified, false);
  assert.equal(p.orderSubmitted, false);
});

test('rejects wrong event, wrong market, wrong outcome and ambiguous side identity', async () => {
  const cases = [
    [e => { e.slug = 'wrong-game'; }, 'EVENT_IDENTITY_MISMATCH'],
    [e => { e.markets[0].slug = 'other-market'; }, 'MARKET_NOT_IN_EVENT'],
    [e => { e.markets[0].marketSides[0].id = '999'; }, 'OUTCOME_IDENTITY_MISMATCH'],
    [e => { delete e.markets[0].marketSides[0].long; }, 'OUTCOME_IDENTITY_MISMATCH'],
    [e => { e.markets[0].marketSides[0].identifier = 'other-symbol'; }, 'OUTCOME_IDENTITY_MISMATCH'],
  ];
  for (const [change, code] of cases) await assert.rejects(prepareUSCombo(choices, { now, fetchImpl: mockEvents(change) }), { message: code });
});

test('rejects closed, halted, untradable, unsupported, started and unknown-time selections', async () => {
  const cases = [
    [e => { e.closed = true; }, 'EVENT_NOT_OPEN'],
    [e => { e.markets[0].status = 'MARKET_STATUS_HALTED'; }, 'MARKET_NOT_OPEN'],
    [e => { e.markets[0].marketSides[0].tradable = false; }, 'OUTCOME_NOT_TRADABLE'],
    [e => { e.markets[0].comboEnabled = false; }, 'MARKET_NOT_COMBO_ENABLED'],
    [e => { e.markets[0].gameStartTime = '2026-11-08T01:00:00Z'; }, 'EVENT_ALREADY_STARTED'],
    [e => { delete e.markets[0].gameStartTime; }, 'START_TIME_UNVERIFIED'],
  ];
  for (const [change, code] of cases) await assert.rejects(prepareUSCombo(choices, { now, fetchImpl: mockEvents(change) }), { message: code });
});

test('rejects duplicate symbols, malformed selections and invalid leg counts before network calls', async () => {
  const never = async () => assert.fail('Unexpected upstream request');
  for (const bad of [[], [choices[0]], Array(51).fill(choices[0]), [choices[0], choices[0]], [{}, choices[0]]]) {
    await assert.rejects(prepareUSCombo(bad, { fetchImpl: never }));
  }
});

test('deduplicates event reads while preserving separate market outcomes', async () => {
  const a = event(0); a.markets.push(event(1).markets[0]);
  let calls = 0;
  const p = await prepareUSCombo([choices[0], { ...choices[1], eventSlug: 'game-a' }], {
    now, fetchImpl: async () => { calls++; return response({ event: a }); },
  });
  assert.equal(calls, 1); assert.equal(p.legs.length, 2);
});

test('signatures verify independently against Ed25519 public key for 32 and 64-byte secrets', async () => {
  for (const secret of [seed, Buffer.concat([seed, Buffer.alloc(32)])]) {
    const h = await retailAuthHeaders({ ...env, POLYMARKET_US_SECRET_KEY: secret.toString('base64') }, 'POST', '/v1/combos', now);
    assert.equal(h['X-PM-Timestamp'], String(now));
    assert.equal(verify(null, Buffer.from(`${now}POST/v1/combos`), publicKey, Buffer.from(h['X-PM-Signature'], 'base64')), true);
    assert.equal(verify(null, Buffer.from(`${now}GET/v1/combos`), publicKey, Buffer.from(h['X-PM-Signature'], 'base64')), false);
  }
});

test('key configuration is never reported as successful authentication', async () => {
  assert.equal(connectionConfiguration(env).credentialsConfigured, true);
  assert.equal(connectionConfiguration(env).authenticated, false);
  assert.equal(connectionConfiguration(env).orderSubmissionSupported, false);
  await assert.rejects(retailAuthHeaders({}, 'GET', '/v1/account/balances'), /KEYS_REQUIRED/);
  await assert.rejects(retailAuthHeaders({ ...env, POLYMARKET_US_SECRET_KEY: 'abc' }, 'GET', '/v1/account/balances'), /KEY_FORMAT_INVALID/);
});

test('connection check targets the authenticated retail host and returns no account balances', async () => {
  const r = await checkUSConnection(env, { now, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.polymarket.us/v1/account/balances');
    assert.equal(options.headers['X-PM-Access-Key'], 'test-only-id');
    return response({ privateBalance: 'secret-account-data' });
  } });
  assert.equal(r.authenticated, true);
  assert.doesNotMatch(JSON.stringify(r), /secret-account-data|test-only-id/);
});

test('creation is opt-in, revalidates legs, and posts only an instrument body', async () => {
  await assert.rejects(createUSCombo(choices, { ...env, POLYMARKET_US_COMBOS_ENABLED: 'false' }), /DISABLED/);
  let posts = 0;
  const p = await createUSCombo(choices, env, { now, fetchImpl: async (url, options) => {
    if (options.method !== 'POST') return mockEvents()(url);
    posts++; assert.equal(url, 'https://api.polymarket.us/v1/combos');
    const body = JSON.parse(options.body);
    assert.deepEqual(Object.keys(body), ['legs']);
    return response({ combo: { id: 'crossd-test', legs: body.legs.toReversed(), state: 'INSTRUMENT_STATE_OPEN' } });
  } });
  assert.equal(posts, 1); assert.equal(p.instrumentCreated, true);
  assert.equal(p.appUrl, null); assert.equal(p.orderSubmitted, false);
});

test('rejects nonmatching or non-open Combo responses without fabricating a share link', async () => {
  for (const variant of ['wrong-legs', 'closed']) {
    await assert.rejects(createUSCombo(choices, env, { now, fetchImpl: async (url, options) => {
      if (options.method !== 'POST') return mockEvents()(url);
      return response({ combo: { id: 'crossd-x', legs: variant === 'wrong-legs' ? [] : JSON.parse(options.body).legs,
        state: variant === 'closed' ? 'INSTRUMENT_STATE_CLOSED' : 'INSTRUMENT_STATE_OPEN' } });
    } }), /COMBO_RESPONSE_LEGS_MISMATCH|COMBO_NOT_OPEN/);
  }
});

test('gateway fails closed for missing/short operator secrets and never exposes credentials', async () => {
  const req = () => new Request('https://edgeforce.test/api/polymarket-us/connection');
  assert.equal((await polymarketUSSlipGateway(req(), {})).status, 401);
  assert.equal((await polymarketUSSlipGateway(req(), { CRON_SECRET: 'short' })).status, 401);
  const status = await polymarketUSSlipGateway(new Request('https://edgeforce.test/api/polymarket-us/status'), env);
  assert.equal(status.headers.get('cache-control'), 'no-store');
  assert.doesNotMatch(await status.text(), /test-only-id|test-operator-secret|secret_key/);
});

test('gateway requires explicit instrument action and refuses order endpoints', async () => {
  const request = (path, body) => new Request(`https://edgeforce.test/api/polymarket-us/${path}`, {
    method: 'POST', headers: { authorization: `Bearer ${env.CRON_SECRET}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  assert.equal((await polymarketUSSlipGateway(request('combos/create', { selections: choices }), env)).status, 422);
  assert.equal((await polymarketUSSlipGateway(request('orders', { quantity: 50 }), env)).status, 404);
  const malformed = new Request('https://edgeforce.test/api/polymarket-us/combos/prepare', {
    method: 'POST', headers: { authorization: `Bearer ${env.CRON_SECRET}`, 'content-type': 'application/json' }, body: '{',
  });
  assert.equal((await polymarketUSSlipGateway(malformed, env)).status, 400);
});

test('upstream errors are sanitized and excessive responses are rejected', async () => {
  const result = await polymarketUSSlipGateway(new Request('https://edgeforce.test/api/polymarket-us/connection', {
    headers: { authorization: `Bearer ${env.CRON_SECRET}` },
  }), env, { fetchImpl: async () => new Response('secret-private-upstream-message', { status: 401 }) });
  assert.equal(result.status, 502);
  assert.equal((await result.json()).error, 'POLYMARKET_US_AUTH_REJECTED');
  await assert.rejects(prepareUSCombo(choices, { now, fetchImpl: async () => new Response('x', { headers: { 'content-length': '9000000' } }) }), /RESPONSE_TOO_LARGE/);
});

test('request byte limit is enforced while streaming, even without content-length', async () => {
  const request = new Request('https://edgeforce.test/api/polymarket-us/combos/prepare', {
    method: 'POST', headers: { authorization: `Bearer ${env.CRON_SECRET}`, 'content-type': 'application/json' },
    body: JSON.stringify({ selections: choices, excess: 'x'.repeat(32769) }),
  });
  const r = await polymarketUSSlipGateway(request, env);
  assert.equal(r.status, 413);
  assert.equal((await r.json()).error, 'REQUEST_TOO_LARGE');
});
