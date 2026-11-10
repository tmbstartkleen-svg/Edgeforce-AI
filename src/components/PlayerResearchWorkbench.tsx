'use client';
import { useState } from 'react';
import { buildPlayerResearchSnapshot } from '@/lib/intelligence-core/player-research-snapshot.mjs';

type Result = ReturnType<typeof buildPlayerResearchSnapshot>;
export default function PlayerResearchWorkbench() {
 const [playerId,setPlayerId]=useState('');
 const [sport,setSport]=useState('nba');
 const [stat,setStat]=useState('assists');
 const [threshold,setThreshold]=useState('6');
 const [raw,setRaw]=useState('[]');
 const [result,setResult]=useState<Result|null>(null);
 const [error,setError]=useState('');
 function analyze() {
  setError('');setResult(null);
  try {
   const games:unknown=JSON.parse(raw);
   if (!Array.isArray(games)) throw new Error('Game-log JSON must be an array.');
   if (!playerId.trim()) throw new Error('Enter an exact athlete identifier.');
   const value=Number(threshold);
   if (!Number.isFinite(value) || value<0) throw new Error('Threshold must be a positive number or zero.');
   setResult(buildPlayerResearchSnapshot({
    playerId:playerId.trim(),sport,games,stat,threshold:value,
    asOf:new Date().toISOString(),
   }));
  } catch(e) {setError(e instanceof Error?e.message:'Cannot analyze this game log.');}
 }
 const css={input:{display:'block',width:'100%',padding:10,borderRadius:8,background:'#101d2a',color:'#fff',border:'1px solid #3e5564'} as const,label:{display:'block',marginBottom:12} as const};
 return <section style={{maxWidth:920,margin:'auto',padding:'24px',color:'#e8f1fa'}}>
  <h1>Player Stat Research</h1>
  <p>Read-only workbench. Paste independently sourced, completed player game logs to review historical streaks. Uploaded JSON is user-supplied and is <strong>not authenticated by EdgeForce</strong>; source fields alone do not certify ESPN data.</p>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
   <label style={css.label}>Sport<select style={css.input} value={sport} onChange={e=>setSport(e.target.value)}><option value="nba">NBA</option><option value="nfl">NFL</option><option value="ncaab">College basketball</option><option value="nhl">NHL</option><option value="mlb">MLB</option><option value="soccer">Soccer</option></select></label>
   <label style={css.label}>Exact player ID<input style={css.input} value={playerId} onChange={e=>setPlayerId(e.target.value)} placeholder="Athlete ID"/></label>
   <label style={css.label}>Statistic<input style={css.input} value={stat} onChange={e=>setStat(e.target.value)} placeholder="assists"/></label>
   <label style={css.label}>At least<input style={css.input} type="number" min="0" step="0.5" value={threshold} onChange={e=>setThreshold(e.target.value)}/></label>
  </div>
  <label style={css.label}>Sourced game-log JSON<textarea style={{...css.input,minHeight:160,fontFamily:'monospace'}} spellCheck={false} value={raw} onChange={e=>setRaw(e.target.value)} aria-label="Sourced game log JSON"/></label>
  <p style={{fontSize:13}}>Required per row: playerId, eventId, upstreamId, observedAt, date, completed=true, sourceUrl and stats keyed by the statistic selected. No data is fetched or stored.</p>
  <button style={{padding:'10px 18px',background:'#177e66',color:'white',border:0,borderRadius:8,cursor:'pointer'}} type="button" onClick={analyze}>Analyze historical record</button>
  {error&&<p role="alert" style={{color:'#ffb8b8'}}>{error}</p>}
  {result&&<article style={{background:'#101d2a',padding:20,marginTop:20,borderRadius:12}} aria-live="polite">
   <h2>{result.status.replaceAll('_',' ')}</h2>
   <p>Source audit: {result.audit.accepted} accepted observations; {result.audit.rejected} rejected. Streak gate: {result.streak.acceptedCount} accepted, {result.streak.rejectedCount} rejected.</p>
   <table style={{width:'100%',textAlign:'left'}}><thead><tr><th>Window</th><th>Hits</th><th>Observed games</th><th>Hit rate</th></tr></thead><tbody>
    <tr><td>Last 5</td><td>{result.streak.last5.hits}</td><td>{result.streak.last5.observed}/5</td><td>{result.streak.last5.hitRate===null?'Insufficient data':(100*result.streak.last5.hitRate).toFixed(1)+'%'}</td></tr>
    <tr><td>Last 10</td><td>{result.streak.last10.hits}</td><td>{result.streak.last10.observed}/10</td><td>{result.streak.last10.hitRate===null?'Insufficient data':(100*result.streak.last10.hitRate).toFixed(1)+'%'}</td></tr>
   </tbody></table>
   <p>Consecutive qualifying games: {result.streak.consecutive}</p>
   {result.reasons.length>0&&<p>Incomplete research: {result.reasons.join(', ')}</p>}
   <p><strong>Betting probability: unavailable.</strong> These historical hit rates are not calibrated forecasts, recommended bets or authorized bet slips.</p>
  </article>}
 </section>;
}
