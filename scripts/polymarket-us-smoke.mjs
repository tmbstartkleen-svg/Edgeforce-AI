// Public live connectivity check only. Does not read keys or mutate exchange state.
import { connectionConfiguration } from '../src/lib/intelligence-core/polymarket-us-slips.mjs';

const index = process.argv.indexOf('--event');
const eventSlug = index >= 0 ? process.argv[index + 1] : '';
if (!eventSlug || !/^[a-z0-9][a-z0-9_-]{0,239}$/.test(eventSlug)) {
  console.error('Usage: node scripts/polymarket-us-smoke.mjs --event <current-event-slug>');
  process.exitCode = 1;
} else {
  try {
    const res = await fetch(`https://gateway.polymarket.us/v1/events/slug/${eventSlug}`, {
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Public gateway HTTP ${res.status}`);
    const { event } = await res.json();
    if (event?.slug !== eventSlug || !Array.isArray(event.markets)) throw new Error('Unexpected event response');
    console.log(JSON.stringify({ ...connectionConfiguration({}), publicGatewayReachable: true,
      observedAt: new Date().toISOString(), eventSlug, eventTitle: event.title,
      active: event.active, closed: event.closed, marketsReturned: event.markets.length,
      comboEnabledMarkets: event.markets.filter(m => m.comboEnabled === true).length,
      instrumentCreated: false, orderSubmitted: false }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Public connectivity check failed');
    process.exitCode = 1;
  }
}
