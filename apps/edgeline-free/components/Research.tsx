import { useEffect, useMemo, useState } from 'react';
import { api, updateLearning } from '../lib/api';
import {
  LEAGUES,
  SEASONS,
  ResearchGame,
  Method,
  evaluate,
  periodKey,
  RESEARCH_VERSION,
} from '../lib/research';

const names: Record<Method, string> = {
  market: 'Bookmaker no-vig',
  poisson: 'Prior-results Poisson',
  monteCarlo: 'Monte Carlo · 10,000 runs',
};
const methods = Object.keys(names) as Method[];
const num = (n: number | null, digits = 1) =>
  n === null ? '—' : n.toFixed(digits);
const fiveYearsAgo = () => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 5);
  return d.toISOString().slice(0, 10);
};
type Observation = {
  key: string;
  sport: string;
  selection: string;
  odds: number;
  capturedAt: string;
  consensus: number | null;
  noVig: number;
  implied: number;
};

export default function Research() {
  const [games, setGames] = useState<ResearchGame[]>([]);
  const [current, setCurrent] = useState<Observation[]>([]);
  const [league, setLeague] = useState('all'),
    [method, setMethod] = useState<Method>('poisson');
  const [from, setFrom] = useState(fiveYearsAgo),
    [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [period, setPeriod] = useState('month'),
    [legs, setLegs] = useState(1),
    [staking, setStaking] = useState('flat');
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(''),
    [errors, setErrors] = useState<string[]>([]);
  const [imported, setImported] = useState<string[]>([]),
    [tab, setTab] = useState('history');
  const [observationDay, setObservationDay] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const partitions = Object.keys(LEAGUES).flatMap((l) =>
    SEASONS.map((s) => ({ league: l, season: s })),
  );
  const merge = (incoming: ResearchGame[]) =>
    setGames((old) => [
      ...new Map([...old, ...incoming].map((g) => [g.key, g])).values(),
    ]);
  async function loadHistory(importData = false) {
    setBusy(true);
    setErrors([]);
    let done = 0;
    for (let i = 0; i < partitions.length; i += 3) {
      await Promise.all(
        partitions.slice(i, i + 3).map(async (partition) => {
          try {
            const response = importData
              ? await api.post('/api/research/import', partition)
              : await api.get(
                  `/api/research/history?league=${partition.league}&season=${partition.season}`,
                );
            const data = response.data as {
              games: ResearchGame[];
              importedAt: string | null;
            };
            if (!Array.isArray(data?.games))
              throw new Error('Unexpected database response');
            merge(data.games);
            if (data.importedAt)
              setImported((old) => [
                ...new Set([...old, `${partition.league}:${partition.season}`]),
              ]);
          } catch (err) {
            setErrors((old) => [
              ...old,
              `${partition.league} ${partition.season}: ${err instanceof Error ? err.message : 'Source unavailable'}`,
            ]);
          } finally {
            done++;
            setProgress(
              `${done}/${partitions.length} league-season files checked`,
            );
          }
        }),
      );
    }
    setBusy(false);
  }
  async function loadCurrent(day: string) {
    try {
      const r = await api.get(`/api/research/current?day=${day}`);
      setCurrent((r.data as { rows: Observation[] }).rows || []);
    } catch (err) {
      setErrors((old) => [
        ...old,
        `Current archive: ${err instanceof Error ? err.message : 'Unavailable'}`,
      ]);
    }
  }
  useEffect(() => {
    (async () => { await updateLearning(setProgress); await loadHistory(); })();
    loadCurrent(observationDay);
  }, []);
  const filtered = useMemo(
    () =>
      games.filter(
        (g) =>
          (league === 'all' || g.league === league) &&
          g.date >= from &&
          g.date <= to,
      ),
    [games, league, from, to],
  );
  const comparison = useMemo(
    () =>
      methods.map((m) => ({
        method: m,
        ...evaluate(filtered, m, legs, staking),
      })),
    [filtered, legs, staking],
  );
  const periods = useMemo(() => {
    const groups = new Map<string, ResearchGame[]>();
    filtered.forEach((g) => {
      const k = periodKey(g.date, period);
      groups.set(k, [...(groups.get(k) ?? []), g]);
    });
    return [...groups]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, rows]) => ({
        key,
        ...evaluate(rows, method, legs, staking),
      }));
  }, [filtered, period, method, legs, staking]);
  const common = filtered.filter(
    (g) => g.odds && g.poisson && g.monteCarlo && g.market,
  );
  const range = [...games].sort((a, b) => a.date.localeCompare(b.date));
  const best = [...comparison]
    .filter((r) => r.brier !== null)
    .sort((a, b) => a.brier! - b.brier!)[0];
  function exportData() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              model: RESEARCH_VERSION,
              filters: { from, to, league, legs, staking },
              comparison,
              periods,
              games: filtered,
            },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'edgeline-research.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section id="research" className="research">
      <div className="titleRow">
        <div>
          <span className="eyebrow">EVIDENCE & PERFORMANCE LAB</span>
          <h2>Which forecasts hold up?</h2>
        </div>
        <button
          className="inspect"
          disabled={!games.length}
          onClick={exportData}
        >
          Export filtered study
        </button>
      </div>
      <p className="researchLead">
        Compare real match results with bookmaker probabilities, prior-results
        models and simulated outcomes. Evaluate stake sizing separately from
        forecast accuracy.
      </p>
      <div className="researchTabs">
        <button
          className={tab === 'history' ? 'active' : ''}
          onClick={() => setTab('history')}
        >
          Historical comparison
        </button>
        <button
          className={tab === 'current' ? 'active' : ''}
          onClick={() => setTab('current')}
        >
          DraftKings observations
        </button>
        <button
          className={tab === 'methodology' ? 'active' : ''}
          onClick={() => setTab('methodology')}
        >
          Methods & coverage
        </button>
      </div>
      <div className="researchCoverage">
        <strong>
          {games.length.toLocaleString()} completed source matches in this browser
        </strong>
        <span>
          {imported.length}/{partitions.length} league-season files ·{' '}
          {range[0]?.date || 'Not yet imported'} to {range.at(-1)?.date || '—'}
        </span>
        <span>
          Free historical study: five soccer leagues, Bet365 pre-closing prices.
          This is NOT five years of all sports or DraftKings history.
        </span>
        <button disabled={busy} onClick={() => loadHistory(true)}>
          {busy ? 'Working…' : 'Import / update free history'}
        </button>
        <span role="status">{progress}</span>
      </div>
      {!!errors.length && (
        <details className="alert">
          <summary>
            {errors.length} source or database checks need attention
          </summary>
          {errors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </details>
      )}
      {tab === 'history' && (
        <>
          <div className="researchFilters">
            <label>
              Sport / league
              <select
                value={league}
                onChange={(e) => setLeague(e.target.value)}
              >
                <option value="all">Soccer · all imported leagues</option>
                {Object.entries(LEAGUES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              From
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              Through
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <label>
              Group by
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                {['day', 'week', 'month', 'year'].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              Structure
              <select
                value={legs}
                onChange={(e) => setLegs(Number(e.target.value))}
              >
                <option value={1}>Singles</option>
                <option value={2}>2-leg research parlays</option>
                <option value={3}>3-leg research parlays</option>
              </select>
            </label>
            <label>
              Stake policy
              <select
                value={staking}
                onChange={(e) => setStaking(e.target.value)}
              >
                <option value="flat">Flat 1% of daily bankroll</option>
                <option value="kelly">Quarter Kelly · 1% cap</option>
              </select>
            </label>
          </div>
          <div className="ledgerStats">
            <div>
              <span>Filtered matches</span>
              <strong>{filtered.length.toLocaleString()}</strong>
            </div>
            <div>
              <span>Common evaluation sample</span>
              <strong>{common.length.toLocaleString()}</strong>
            </div>
            <div>
              <span>Missing odds / model warm-up</span>
              <strong>{filtered.length - common.length}</strong>
            </div>
            <div>
              <span>Lowest Brier score in sample</span>
              <strong className="smallMetric">
                {best ? names[best.method] : 'Awaiting data'}
              </strong>
            </div>
          </div>
          <p className="researchNote">
            Every method uses the same eligible matches. Lowest historical error
            is descriptive, not proof of future superiority. Kelly may skip
            selections and therefore has a different ticket count. Use date
            filters to reserve a later evaluation window before selecting a
            strategy; models never learn from the current day’s results.
          </p>
          <div className="researchTable">
            <table>
              <caption>
                Forecast and paper-return comparison · $100 starting bankroll
              </caption>
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Tickets</th>
                  <th>Hit rate</th>
                  <th>95% hit interval</th>
                  <th>Brier ↓</th>
                  <th>Log loss ↓</th>
                  <th>ROI</th>
                  <th>End bankroll</th>
                  <th>Max daily drawdown</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((r) => (
                  <tr key={r.method}>
                    <th>{names[r.method]}</th>
                    <td>{r.tickets}</td>
                    <td>{num(r.hitRate)}%</td>
                    <td>
                      {num(r.lower)}–{num(r.upper)}%
                    </td>
                    <td>{num(r.brier, 3)}</td>
                    <td>{num(r.logLoss, 3)}</td>
                    <td>{num(r.roi)}%</td>
                    <td>${r.bankroll.toFixed(2)}</td>
                    <td>{r.drawdown.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="researchMethod">
            Timeline method
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as Method)}
            >
              {methods.map((m) => (
                <option key={m} value={m}>
                  {names[m]}
                </option>
              ))}
            </select>
          </label>
          <div className="researchTable">
            <table>
              <caption>
                {period} performance · each row restarts at $100 · calendar
                dates use the source’s match date
              </caption>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Eligible games</th>
                  <th>Tickets</th>
                  <th>Wins</th>
                  <th>Hit %</th>
                  <th>Brier ↓</th>
                  <th>ROI %</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((r) => (
                  <tr key={r.key}>
                    <th>{r.key}</th>
                    <td>{r.games}</td>
                    <td>{r.tickets}</td>
                    <td>{r.wins}</td>
                    <td>{num(r.hitRate)}</td>
                    <td>{num(r.brier, 3)}</td>
                    <td>{num(r.roi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!periods.length && (
              <div className="empty">
                Import historical files to measure outcomes. No performance
                percentages are fabricated.
              </div>
            )}
          </div>
        </>
      )}
      {tab === 'current' && (
        <>
          <div className="researchFilters">
            <label>
              Archive date (UTC)
              <input
                type="date"
                value={observationDay}
                onChange={(e) => {
                  setObservationDay(e.target.value);
                  loadCurrent(e.target.value);
                }}
              />
            </label>
            <button onClick={() => loadCurrent(observationDay)}>
              Reload current archive
            </button>
          </div>
          <p className="researchNote">
            Server-stored pregame observations from actual provider snapshots.
            Capture occurs when the app reads or refreshes a fresh feed; it is
            not an always-on collection service. Results are pending a verified
            settlement feed, so these rows do not yet contribute to accuracy
            rankings.
          </p>
          <div className="researchTable">
            <table>
              <caption>
                {current.length} stored observations for {observationDay}
              </caption>
              <thead>
                <tr>
                  <th>Sport</th>
                  <th>Selection</th>
                  <th>DraftKings</th>
                  <th>DK implied</th>
                  <th>Consensus</th>
                  <th>Captured UTC</th>
                </tr>
              </thead>
              <tbody>
                {current.map((r) => (
                  <tr key={r.key}>
                    <td>{r.sport}</td>
                    <th>{r.selection}</th>
                    <td>
                      {r.odds > 0 ? '+' : ''}
                      {r.odds}
                    </td>
                    <td>{r.implied.toFixed(1)}%</td>
                    <td>
                      {r.consensus === null
                        ? 'Unavailable'
                        : `${r.consensus.toFixed(1)}%`}
                    </td>
                    <td>{r.capturedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === 'methodology' && (
        <div className="researchMethods">
          <article>
            <h3>Data coverage</h3>
            <p>
              Source:{' '}
              <a
                href="https://www.football-data.co.uk/"
                target="_blank"
                rel="noreferrer"
              >
                Football-Data.co.uk
              </a>
              . Premier League, La Liga, Bundesliga, Serie A and Ligue 1.
              Seasons 2021/22–2026/27 where available; the default filter is the
              past five years. All completed games in those files are stored,
              including rows excluded for missing prices or model warm-up.
            </p>
            <p>
              Prices are Bet365 pre-closing H/D/A odds, not DraftKings and not
              maximum prices assembled across books. Per-quote collection
              timestamps are unavailable. This is a retrospective research
              replay; quoted prices may not have been executable together.
            </p>
          </article>
          <article>
            <h3>Models and leakage controls</h3>
            <p>
              Version {RESEARCH_VERSION}. The baseline removes the margin from
              the three bookmaker prices. Poisson uses each team’s prior 20
              games, league home/away scoring rates, five-game shrinkage and 60
              league games of warm-up each season. A team needs five prior
              matches. All matches on a date are predicted before that day
              updates the model.
            </p>
            <p>
              Monte Carlo samples the Poisson probabilities 10,000 times with
              reproducible seeds. It is an approximation of the same model, not
              an independent source of predictive information. Brier is the sum
              of squared errors over home/draw/away; lower Brier and log loss
              are better.
            </p>
          </article>
          <article>
            <h3>Staking and parlay assumptions</h3>
            <p>
              Each model chooses its highest-probability result per match.
              Singles use every eligible match. Parlays group
              chronological-date, stable-ID ordered games within the same league
              and day into non-overlapping groups of two or three; leftover
              games are excluded. Joint probability assumes independence, and
              payout multiplies the individual Bet365 decimal prices. These are
              hypothetical parlays, not sportsbook quotes.
            </p>
            <p>
              Flat stakes use 1% of opening daily bankroll. Quarter Kelly uses ¼
              × max(0, (p × decimal − 1)/(decimal − 1)), capped at 1% per
              ticket. Total daily exposure is scaled to at most 10%; returns
              settle at day-end. Kelly sizes exposure and does not improve a
              forecast. No cash-out, promotions, taxes, limits or commissions
              are modelled.
            </p>
          </article>
          <article>
            <h3>What remains unproven</h3>
            <p>
              Hit-rate intervals assume independent tickets and may understate
              uncertainty. Comparing many filters creates selection bias. Do not
              treat the best historical slice as a proven edge. Reserve later
              dates for evaluation before choosing a strategy. All-sports
              DraftKings history, player profiles, injury/weather inputs and
              verified live settlements require additional feeds.
            </p>
          </article>
        </div>
      )}
    </section>
  );
}
