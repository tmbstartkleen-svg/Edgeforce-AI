import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import CoverageEvents from './CoverageEvents';

const tools = [
  ['OddsJam', 'Opportunity discovery', 'Compare sportsbook prices and evaluate potential +EV and arbitrage. Verify timestamps, limits and fees before judging an opportunity.', 'https://oddsjam.com/'],
  ['Unabated', 'Market benchmarks', 'Vig-free reference lines, line comparison and market research. A benchmark is not an independent injury-adjusted forecast.', 'https://unabated.com/'],
  ['Outlier', 'Player-prop research', 'Player history, matchup research and price comparison. Check sport, league and bookmaker availability.', 'https://outlier.bet/'],
  ['Rithmm', 'Model evaluation', 'Predictive models and probability explanations. Evaluate calibration and results on unseen games.', 'https://www.rithmm.com/'],
  ['SharpStack', 'Cross-market discovery', 'Evaluate its advertised +EV, arbitrage and prediction-market coverage against DK, FanDuel, Kalshi and Polymarket.', 'https://www.4for4.com/sharpstack-landing'],
  ['StatsNext', 'Broad sports research', 'Team, player, matchup and price research; injury and lineup availability depends on the sport and source.', 'https://statsnext.com/'],
  ['PropsIQ', 'Prop evidence', 'Game logs, hit rates, opponent context and model research. Historical hit rate is not a calibrated win probability.', 'https://propsiq.app/'],
  ['Pikkit', 'Performance tracking', 'Track results, trends and closing-line value. Separate actual results from paper simulations.', 'https://pikkit.com/'],
];
type Source = { provider: string; checkedAt: string; error: string | null; entries: { id: string; name: string; group: string; url: string }[] };
export default function ProfessionalDesk({ coverage = false }: { coverage?: boolean }) {
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState('All');
  const [selection, setSelection] = useState<{ provider: string; id: string; name: string } | null>(null);
  useEffect(() => {
    if (!coverage) return;
    let active = true;
    api.get('/api/coverage').then(({ data }) => { if (active) setSources(data.sources); })
      .catch(() => { if (active) setError('Coverage sources unavailable. Please try again later.'); });
    return () => { active = false; };
  }, [coverage]);
  if (!coverage) return <section aria-label='Professional tools'>
    <span className='eyebrow'>RESEARCH WORKBENCH</span>
    <h2>Professional tools to evaluate</h2>
    <p>Vendor-described capabilities, reviewed October 26, 2026. These are evaluation links, not connected feeds or independently verified performance claims. No subscriptions have been purchased.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginTop: 20 }}>
      {tools.map(([name, role, description, url]) => <article key={name} style={{ border: '1px solid #334155', borderRadius: 14, padding: 20 }}>
        <span className='eyebrow'>{role}</span><h3>{name}</h3><p>{description}</p>
        <a href={url} target='_blank' rel='noopener noreferrer'>Evaluate {name} ↗</a>
      </article>)}
    </div>
    <h3>Our three jobs</h3>
    <p><b>Discover:</b> compare equivalent markets, prices, timestamps, fees and available liquidity.</p>
    <p><b>Forecast:</b> use verified lineups, injuries and historical data; validate on unseen games. Current desk simulations use market inputs, not an independent player model.</p>
    <p><b>Measure:</b> keep paper and actual results separate; measure calibration, ROI, drawdown and closing-line value.</p>
    <h3>Acceptance checklist</h3>
    <p>Require exact league coverage, regional bookmaker access, export/API rights, quote age, fee treatment and an independently testable history. A tool subscription does not automatically grant a reusable data feed.</p>
  </section>;
  const rows = sources.flatMap((source) => source.entries.map((entry) => ({ ...entry, provider: source.provider })))
    .filter((row) => (provider === 'All' || row.provider === provider) && `${row.name} ${row.group} ${row.id}`.toLowerCase().includes(query.toLowerCase()));
  return <section aria-label='International coverage'>
    <span className='eyebrow'>COVERAGE AUDIT</span><h2>Live & international coverage</h2>
    <p>Catalog discovery and on-demand event inspection are connected below. Catalog entries are not live games or simulation-ready selections. Free sportsbook snapshots are available on the main desk.</p>
    <div className='alert'>DraftKings in-play, Kalshi contract prices and Polymarket executable prices are not connected to the simulation engine. The reported 39 DK / 87 Polymarket figures have not been verified as comparable live-game totals.</div>
    <h3>DraftKings international gap</h3>
    <p>Observed October 26, 2026: 30 basketball competitions in the public menu, including EuroLeague, EuroCup, Australia NBL/WNBL, Lebanon FLB, Israel, Germany, Brazil, Argentina and Uruguay. Soccer also includes lower divisions and international leagues beyond the major European competitions.</p>
    <p>Choose a provider league on the main desk and refresh within the shared free-credit budget. Schedule coverage does not imply available DraftKings odds. Full in-play coverage needs a licensed source with those exact leagues and suitable refresh limits.</p>
    <p><a href='https://sportsbook.draftkings.com/sports/basketball' target='_blank' rel='noopener noreferrer'>DK basketball directory ↗</a> · <a href='https://sportsbook.draftkings.com/sports/soccer' target='_blank' rel='noopener noreferrer'>DK soccer directory ↗</a> · <a href='https://sportsbook.draftkings.com/live' target='_blank' rel='noopener noreferrer'>DK live board ↗</a></p>
    <h3>Public prediction-market catalogs</h3>
    <p>Search league names and aliases. Kalshi lists contract series; Polymarket lists sports/competitions. Some are inactive or futures. Polymarket.com is view-only for US visitors; its US product has separate availability.</p>
    {error && <p role='alert'>{error}</p>}
    {!sources.length && !error && <p role='status'>Loading public coverage catalogs…</p>}
    {sources.map((source) => <p key={source.provider}><b>{source.provider}:</b> {source.error || `${source.entries.length} catalog entries`} · Checked {new Date(source.checkedAt).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</p>)}
    <label>Provider <select value={provider} onChange={(event) => setProvider(event.target.value)}><option>All</option><option>Kalshi</option><option>Polymarket</option></select></label>{' '}
    <label>Search competitions <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Basketball, Euro, soccer, country…' /></label>
    <p>{rows.length} matching catalog entries · showing up to 150; narrow your search for more.</p>
    {selection && <CoverageEvents selection={selection} />}
    <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', textAlign: 'left' }}><thead><tr><th>Provider</th><th>Competition / contract series</th><th>Category / code</th><th>Availability</th></tr></thead>
      <tbody>{rows.slice(0, 150).map((row) => <tr key={`${row.provider}-${row.id}`}><td>{row.provider}</td><td><a href={row.url} target='_blank' rel='noopener noreferrer'>{row.name} ↗</a></td><td>{row.group}</td><td><button onClick={() => setSelection({ provider: row.provider, id: row.id, name: row.name })}>Inspect events</button></td></tr>)}</tbody></table></div>
    <p>Catalogs are cached for up to 15 minutes. No paid odds credits are used here. Inspect events for current open contracts, source price snapshots and settlement rules. Full live coverage, executable depth, verified injuries/lineups and historical model validation remain incomplete.</p>
  </section>;
}
