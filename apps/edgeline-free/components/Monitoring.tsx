import { useEffect, useState } from 'react';
import { api, histories, updateLearning } from '../lib/api';
import { evaluate, RESEARCH_VERSION, ResearchGame } from '../lib/research';
export default function Monitoring() {
  const [health,setHealth] = useState<any>(null), [error,setError] = useState(''), [busy,setBusy] = useState(false), [progress,setProgress] = useState('');
  const [games,setGames] = useState<ResearchGame[]>([]), [loaded,setLoaded] = useState(false), [last,setLast] = useState<string|null>(null);
  async function load() { try { const all = (await histories()).filter(h=>h.version===RESEARCH_VERSION); setGames([...new Map(all.flatMap(h=>h.games).map(g=>[g.key,g])).values()]); setLast(all.map(h=>h.importedAt || '').sort().at(-1)||null); setLoaded(true); } catch(e) { setError(e instanceof Error ? e.message : 'Storage unavailable'); } }
  async function check() { setError(''); try { setHealth((await api.get('/api/monitoring')).data); } catch(e) { setError(e instanceof Error ? e.message : 'Health check failed'); } }
  async function learn() { setBusy(true); try { await updateLearning(setProgress); await load(); } finally { setBusy(false); } }
  useEffect(()=>{ check(); load(); },[]);
  return <section className="researchPanel"><div className="titleRow"><div><span className="eyebrow">SYSTEM STATUS</span><h2>Monitoring & learning</h2></div><button onClick={check}>Check health</button></div>
    <p>Checks run when this section opens or when you request them. No paid monitoring service or background collector.</p>
    {error && <p role="alert" className="alert">{error}</p>}
    <div className="researchCoverage"><strong>{health ? 'API reachable' : 'Health not yet verified'}</strong><span>Last check: {health?.checkedAt || '—'}</span><span>Paid odds: {health ? health.paidOddsEnabled ? 'ENABLED — investigate' : 'Disabled' : 'Unknown'}</span><span>Sports archive writes: {health ? health.archiveWritesEnabled ? 'ENABLED — investigate' : 'Disabled' : 'Unknown'}</span><span>Scheduled execution: {health ? health.scheduledExecutionEnabled ? 'ENABLED — investigate' : 'Disabled' : 'Unknown'}</span></div>
    <p>{health?.quota} Billing details cannot be read by the connected login; no billing settings were changed.</p>
    <h3>Source coverage</h3><ul><li>Kalshi / Polymarket: public catalog and event snapshots, checked on demand in International coverage. Source errors and capture times appear there.</li><li>DraftKings / FanDuel: automatic collection disabled. No current prices or live coverage claimed.</li><li>Injuries, rosters and independent all-sport forecasts: unverified; excluded from learning.</li></ul>
    <h3>Learning from completed results</h3><p>Five soccer leagues only. When Research lab opens, current-season results are checked at most daily per league in this browser. Predictions for a date use only earlier results. Corrections replace the same game rather than counting it twice. This is historical replay, not demonstrated live forecasting performance.</p>
    <button disabled={busy} onClick={learn}>{busy ? 'Checking results…' : 'Update learning now'}</button><p role="status">{progress}</p>
    <p>{loaded ? games.length.toLocaleString() : '—'} completed matches retained in this browser. Last successful import: {last || 'None yet'}. Model: {RESEARCH_VERSION}.</p>
    <div style={{overflowX:'auto'}}><table><thead><tr><th>Model</th><th>Scored games</th><th>Brier score ↓</th><th>Log loss ↓</th></tr></thead><tbody>{(['market','poisson','monteCarlo'] as const).map(m=>{const score=evaluate(games,m,1,'flat');return <tr key={m}><td>{m==='market'?'No-vig market':m==='poisson'?'Prior-results Poisson':'Monte Carlo'}</td><td>{score.games}</td><td>{score.brier?.toFixed(4)??'Not evaluated'}</td><td>{score.logLoss?.toFixed(4)??'Not evaluated'}</td></tr>})}</tbody></table></div>
    <p>Scores use each model’s eligible matches; compare shared samples in Research lab before drawing conclusions. No automatic promotion into live picks. Local data can be cleared by your browser; export research before moving devices. Old AppDeploy paper tickets remain at the old origin and have not been migrated.</p>
  </section>;
}
