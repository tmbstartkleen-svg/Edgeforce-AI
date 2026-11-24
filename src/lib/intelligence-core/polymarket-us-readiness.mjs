// Polymarket US readiness boundary: public search, exact Combo preparation, and read-only account connectivity only.
const GATEWAY = 'https://gateway.polymarket.us';
const RETAIL = 'https://api.polymarket.us';
const MAX_BYTES = 8_000_000;
const encoder = new TextEncoder();

export class PolymarketUSReadinessError extends Error {
  constructor(code, status = 422) {
    super(code);
    this.name = 'PolymarketUSReadinessError';
    this.status = status;
  }
}

function fail(code, status) { throw new PolymarketUSReadinessError(code, status); }
function slug(value) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,239}$/.test(value)) fail('INVALID_SLUG');
  return value;
}

async function readLimitedText(target, limit, code, status = 502) {
  if (Number(target.headers.get('content-length')) > limit) fail(code, status);
  const reader = target.body?.getReader();
  if (!reader) return '';
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); fail(code, status); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

async function jsonRequest(fetchImpl, url, options = {}) {
  let response;
  try {
    response = await fetchImpl(url, { ...options, redirect: 'manual', signal: AbortSignal.timeout(8000) });
  } catch { fail('POLYMARKET_US_UNREACHABLE', 502); }
  if (!response.ok) {
    const status = response.status;
    if (status === 401 || status === 403) fail('POLYMARKET_US_AUTH_REJECTED', 502);
    if (status === 429) fail('POLYMARKET_US_RATE_LIMITED', 503);
    if (status === 404) fail('POLYMARKET_US_NOT_FOUND', 404);
    fail('POLYMARKET_US_REQUEST_REJECTED', 502);
  }
  const text = await readLimitedText(response, MAX_BYTES, 'UPSTREAM_RESPONSE_TOO_LARGE');
  try { return JSON.parse(text); }
  catch { fail('INVALID_UPSTREAM_RESPONSE', 502); }
}

export function connectionConfiguration(env = {}) {
  return {
    venue: 'Polymarket US',
    credentialsConfigured: Boolean(env.POLYMARKET_US_KEY_ID && env.POLYMARKET_US_SECRET_KEY),
    authenticated: false,
    authenticationChecked: false,
    comboPreparationSupported: true,
    instrumentCreationSupported: false,
    orderSubmissionSupported: false,
    accountMutationSupported: false,
    appPreloadVerified: false,
  };
}

export async function searchUSMarkets(query, { fetchImpl = fetch } = {}) {
  if (typeof query !== 'string' || query.trim().length < 2 || query.length > 120) fail('INVALID_SEARCH_QUERY');
  return jsonRequest(fetchImpl, `${GATEWAY}/v1/search?${new URLSearchParams({ query: query.trim(), limit: '20' })}`);
}

function validateSelection(selection) {
  if (!selection || typeof selection !== 'object') fail('INVALID_SELECTION');
  slug(selection.eventSlug);
  slug(selection.marketSlug);
  if (typeof selection.outcomeId !== 'string' || !/^[0-9]{1,32}$/.test(selection.outcomeId)) fail('INVALID_OUTCOME_ID');
}

function resolveSelection(selection, event, now) {
  if (!event || event.slug !== selection.eventSlug) fail('EVENT_IDENTITY_MISMATCH');
  if (event.active !== true || event.closed !== false || event.ended === true) fail('EVENT_NOT_OPEN');
  const market = event.markets?.find(m => m.slug === selection.marketSlug);
  if (!market) fail('MARKET_NOT_IN_EVENT');
  if (market.active !== true || market.closed !== false || market.status !== 'MARKET_STATUS_OPEN') fail('MARKET_NOT_OPEN');
  if (market.comboEnabled !== true) fail('MARKET_NOT_COMBO_ENABLED');
  const startTime = Date.parse(market.gameStartTime || event.startDate || '');
  if (!Number.isFinite(startTime)) fail('START_TIME_UNVERIFIED');
  if (startTime <= now) fail('EVENT_ALREADY_STARTED');
  const side = market.marketSides?.find(s => String(s.id) === selection.outcomeId);
  if (!side || typeof side.long !== 'boolean' || side.identifier !== market.slug) fail('OUTCOME_IDENTITY_MISMATCH');
  if (side.tradable !== true) fail('OUTCOME_NOT_TRADABLE');
  const description = side.description || side.team?.name;
  if (typeof description !== 'string' || !description.trim()) fail('OUTCOME_LABEL_UNVERIFIED');
  const rawPrice = side.quote?.value ?? side.price;
  const price = rawPrice === null || rawPrice === undefined || rawPrice === '' ? NaN : Number(rawPrice);
  return {
    eventSlug: event.slug,
    eventTitle: event.title || event.slug,
    marketSlug: market.slug,
    marketTitle: market.title || market.question || market.slug,
    line: market.line ?? null,
    outcomeId: String(side.id),
    selection: description,
    symbol: side.identifier,
    side: side.long ? 'SIDE_BUY' : 'SIDE_SELL',
    quotedPrice: Number.isFinite(price) && price > 0 && price < 1 ? price : null,
    startsAt: new Date(startTime).toISOString(),
    eventUrl: `https://polymarket.us/event/${event.slug}`,
    linkKind: 'EVENT_NAVIGATION_ONLY',
    appPreloadVerified: false,
    priceFreshnessVerified: false,
  };
}

export async function prepareUSCombo(selections, { fetchImpl = fetch, now = Date.now() } = {}) {
  if (!Array.isArray(selections) || selections.length < 2 || selections.length > 50) fail('COMBO_REQUIRES_2_TO_50_LEGS');
  const symbols = new Set();
  for (const selection of selections) {
    validateSelection(selection);
    if (symbols.has(selection.marketSlug)) fail('DUPLICATE_MARKET');
    symbols.add(selection.marketSlug);
  }
  const events = new Map();
  for (const selection of selections) {
    if (!events.has(selection.eventSlug)) {
      const result = await jsonRequest(fetchImpl, `${GATEWAY}/v1/events/slug/${selection.eventSlug}`);
      const event = result.event;
      const requestedMarkets = new Set(selections.filter(s => s.eventSlug === selection.eventSlug).map(s => s.marketSlug));
      events.set(selection.eventSlug, event && { slug: event.slug, title: event.title,
        active: event.active, closed: event.closed, ended: event.ended, startDate: event.startDate,
        markets: Array.isArray(event.markets) ? event.markets.filter(m => requestedMarkets.has(m.slug)) : [] });
    }
  }
  const legs = selections.map(s => resolveSelection(s, events.get(s.eventSlug), now));
  return {
    venue: 'Polymarket US',
    mode: 'READ_ONLY_COMBO_PREPARATION',
    observedAt: new Date(now).toISOString(),
    legs,
    requestBody: { legs: legs.map(({ symbol, side }) => ({ symbol, side })) },
    instrumentCreated: false,
    orderSubmitted: false,
    externalWrites: 0,
    appUrl: null,
    appPreloadVerified: false,
  };
}

export async function retailReadAuthHeaders(env, path, now = Date.now()) {
  const keyId = env.POLYMARKET_US_KEY_ID;
  const secret = env.POLYMARKET_US_SECRET_KEY;
  if (typeof keyId !== 'string' || !keyId || typeof secret !== 'string' || !secret) fail('POLYMARKET_US_KEYS_REQUIRED', 503);
  if (path !== '/v1/account/balances') fail('INVALID_READ_AUTH_REQUEST');
  let decoded;
  try { decoded = Uint8Array.from(atob(secret), c => c.charCodeAt(0)); }
  catch { fail('POLYMARKET_US_KEY_FORMAT_INVALID', 503); }
  if (![32, 64].includes(decoded.length)) fail('POLYMARKET_US_KEY_FORMAT_INVALID', 503);
  const prefix = Uint8Array.from([0x30,0x2e,0x02,0x01,0,0x30,0x05,0x06,0x03,0x2b,0x65,0x70,0x04,0x22,0x04,0x20]);
  const pkcs8 = new Uint8Array(prefix.length + 32);
  pkcs8.set(prefix); pkcs8.set(decoded.subarray(0, 32), prefix.length);
  let signature;
  try {
    const key = await crypto.subtle.importKey('pkcs8', pkcs8, 'Ed25519', false, ['sign']);
    signature = await crypto.subtle.sign('Ed25519', key, encoder.encode(`${now}GET${path}`));
  } catch { fail('POLYMARKET_US_SIGNING_FAILED', 503); }
  return {
    'X-PM-Access-Key': keyId,
    'X-PM-Timestamp': String(now),
    'X-PM-Signature': btoa(String.fromCharCode(...new Uint8Array(signature))),
  };
}

export async function checkUSConnection(env, { fetchImpl = fetch, now = Date.now() } = {}) {
  const path = '/v1/account/balances';
  await jsonRequest(fetchImpl, `${RETAIL}${path}`, { headers: await retailReadAuthHeaders(env, path, now) });
  return { ...connectionConfiguration(env), authenticated: true, authenticationChecked: true, externalWrites: 0 };
}

function reply(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export async function polymarketUSReadinessGateway(request, env = {}, options = {}) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '');
  if (path === '/api/polymarket-us/status' && request.method === 'GET') return reply(connectionConfiguration(env));
  const secrets = [env.CRON_SECRET, env.INGEST_SECRET].filter(s => typeof s === 'string' && s.length >= 32);
  if (!secrets.some(s => request.headers.get('authorization') === `Bearer ${s}`)) {
    return reply({ ok: false, error: 'UNAUTHORIZED' }, 401);
  }
  try {
    if (request.method === 'GET' && path === '/api/polymarket-us/search') {
      return reply({ ok: true, result: await searchUSMarkets(url.searchParams.get('q'), options), externalWrites: 0 });
    }
    if (request.method === 'GET' && path === '/api/polymarket-us/connection') {
      return reply({ ok: true, ...await checkUSConnection(env, options) });
    }
    if (request.method !== 'POST') return reply({ ok: false, error: 'ROUTE_OR_METHOD_NOT_SUPPORTED' }, 405);
    if (path !== '/api/polymarket-us/combos/prepare') {
      return reply({ ok: false, error: 'READ_ONLY_ROUTE' }, 405);
    }
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      return reply({ ok: false, error: 'JSON_REQUIRED' }, 415);
    }
    const text = await readLimitedText(request, 32_768, 'REQUEST_TOO_LARGE', 413);
    let body;
    try { body = JSON.parse(text); } catch { return reply({ ok: false, error: 'INVALID_JSON' }, 400); }
    const result = await prepareUSCombo(body?.selections, options);
    return reply({ ok: true, ...result });
  } catch (error) {
    return reply({ ok: false, error: error instanceof PolymarketUSReadinessError ? error.message : 'POLYMARKET_US_OPERATION_FAILED' },
      error instanceof PolymarketUSReadinessError ? error.status : 502);
  }
}
