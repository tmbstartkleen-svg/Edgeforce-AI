import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
type Page = { checkedAt: string; nextCursor: string | null; more: boolean; error: string | null; events: { id: string; title: string; state: string; startsAt: string | null; url: string; markets: { id: string; title: string; prices: string; rules: string; updatedAt: string | null }[] }[] };
export default function CoverageEvents({ selection }: { selection: { provider: string; id: string; name: string } }) {
  const [page, setPage] = useState<Page | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 10000); return () => clearInterval(timer); }, []);
  const request = useRef(0);
  async function load(cursor = '') {
    const token = ++request.current;
    setBusy(true); setProblem(''); if (!cursor) setPage(null);
    try {
      const { data } = await api.get(`/api/coverage/events?provider=${encodeURIComponent(selection.provider)}&id=${encodeURIComponent(selection.id)}&cursor=${encodeURIComponent(cursor)}`);
      if (request.current === token) {
        if (data.error) { setProblem(data.error); return; }
        setPage((previous) => {
          if (!cursor || !previous) return data;
          const merged = new Map(previous.events.map((event) => [event.id, event]));
          data.events.forEach((event: Page['events'][number]) => merged.set(event.id, event));
          return { ...data, checkedAt: previous.checkedAt, events: [...merged.values()] };
        });
      }
    } catch { if (request.current === token) setProblem('Unable to load events. Try again later.'); }
    finally { if (request.current === token) setBusy(false); }
  }
  useEffect(() => { load(); return () => { request.current += 1; }; }, [selection.provider, selection.id]);
  return <section aria-label='Competition events' style={{ border: '1px solid #334155', borderRadius: 14, padding: 20, margin: '20px 0' }}>
    <h3>{selection.provider}: {selection.name}</h3>
    <p>Read-only market snapshots, cached for up to one minute. Prices exclude fees and execution depth; displayed cents are market prices, not forecast probabilities. These markets are not added to the simulation or ticket builders.</p>
    <button onClick={() => load()} disabled={busy}>{busy ? 'Loading events…' : 'Reload events'}</button>
    {(problem || page?.error) && <p role='alert'>{problem || page?.error}</p>}
    {page && !page.error && <>
      <p role='status'>{page.events.length} events · {page.events.reduce((sum, event) => sum + event.markets.length, 0)} open markets · Oldest page retrieved {new Date(page.checkedAt).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</p>
      {now - Date.parse(page.checkedAt) > 60000 && <p role='alert'>Snapshot older than one minute. Reload before comparing prices or game status.</p>}
      {page.more && <p>Partial result: more events are available. <button disabled={busy} onClick={() => load(page.nextCursor || '')}>Load more events</button></p>}
      {!page.events.length && <p>No open events returned for this entry. Catalog presence does not guarantee current games.</p>}
      {page.events.map((event) => <details key={event.id} style={{ padding: 12, borderTop: '1px solid #334155' }}>
        <summary>{event.title} — {event.state} · {event.markets.length} markets</summary>
        <p>{event.startsAt ? `Scheduled start: ${new Date(event.startsAt).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET` : 'Verified game start unavailable. Market closing time is not used as game start.'}</p>
        <a href={event.url} target='_blank' rel='noopener noreferrer'>Open provider page ↗</a>
        {event.markets.map((market) => <article key={market.id} style={{ padding: '12px 0' }}>
          <h4>{market.title}</h4><p>{market.prices}</p>
          <p>Source metadata updated: {market.updatedAt ? new Date(market.updatedAt).toLocaleString('en-US', { timeZone: 'America/New_York' }) + ' ET' : 'unavailable'}. This is not a verified quote-change timestamp.</p>
          <details><summary>Settlement rules</summary><p style={{ whiteSpace: 'pre-wrap' }}>{market.rules || 'Rules unavailable; inspect the provider before comparing this market.'}</p></details>
        </article>)}
      </details>)}
    </>}
  </section>;
}
