'use client';
import {useState} from 'react';
type SportCover={sport:string;layers:Record<string,number>;coveredByRecords:boolean;lastEvent:string|null};
type Coverage={status?:string;ok:boolean;sports?:SportCover[];recordedSports?:number;totalRegistrySports?:number;sourceScoreWritesEnabled?:boolean;warning?:string};
type History={ok:boolean;status?:string;entries?:Array<{id:string;source:string;sport:string;scheduledAt?:string;eventTime?:string;awayName?:string;homeName?:string;awayScore?:number;homeScore?:number;description?:string;verification:string}>;warning?:string};
const D=(v?:string|null)=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Not recorded';
const KEYS=[['FINAL_SCORE','Final scores'],['PLAY_BY_PLAY','Play events'],['PLAYER_STAT','Player stats'],['MARKET_OBSERVATION','Odds history'],['MODEL_FORECAST','Model forecasts']];
export default function SportsOutcomeCoverage({token,sport}:{token:string;sport:string}){
 const [coverage,setCoverage]=useState<Coverage|null>(null),[history,setHistory]=useState<History|null>(null);
 const [view,setView]=useState<'scores'|'plays'>('scores');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[capture,setCapture]=useState('');
 const [feedId,setFeedId]=useState('nfl'),[day,setDay]=useState('');
 const auth={Authorization:'Bearer '+token};
 const load=async(type:'coverage'|'scores'|'plays')=>{
  if(busy)return;setBusy(true);setError('');
  try{
   const query=new URLSearchParams({view:type,...(sport==='ALL'?{}:{sport})});
   const res=await fetch('/api/network/v1/coverage?'+query,{headers:auth,cache:'no-store'});
   const data=await res.json() as Coverage&History;
   if(!res.ok)throw Error(data.status||'Coverage data unavailable');
   if(type==='coverage')setCoverage(data);
   else{setHistory(data);setView(type)}
  }catch(e){setError(e instanceof Error?e.message:'Coverage unavailable')}
  finally{setBusy(false)}
 };
 const collect=async()=>{
  if(busy||!coverage?.sourceScoreWritesEnabled)return;
  setBusy(true);setError('');setCapture('');
  try{
   const res=await fetch('/api/network/v1/outcomes/capture',{method:'POST',headers:{...auth,'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({feedId,date:day})});
   const data=await res.json() as {status?:string;newRevisions?:number;finalScoreObservations?:number};
   if(!res.ok)throw Error(data.status||'Score source unavailable');
   setCapture(String(data.newRevisions??0)+' new revisions saved from '+String(data.finalScoreObservations??0)+' FINAL observations. Recheck coverage to refresh.');
  }catch(e){setError(e instanceof Error?e.message:'Score collection unavailable')}
  finally{setBusy(false)}
 };
 return <section className="efCoverage" aria-label="Sports Network historical results and coverage">
  <div className="efWarehouseHead"><div><span className="efKicker">EDGEFORCE SPORTS NETWORK / V209</span>
   <h3>Historical results & coverage</h3>
   <p>See which sports have real recorded scores, play-by-play, player stats, archived odds and forecasts. Unavailable records remain visibly absent.</p>
  </div><span className="efWarehouseTag">SOURCE IDENTIFIED</span></div>
  <div className="efWarehouseActions">
   <button type="button" disabled={busy||token.length!==64} onClick={()=>void load('coverage')}>Inspect all-sports coverage</button>
   {coverage&&<span>{coverage.recordedSports??0} sports with actual records / {coverage.totalRegistrySports??0} registered feeds</span>}
  </div>
  {coverage&&<div>
   <div className="efCoverageMetrics">{KEYS.map(([key,label])=><div key={key}><small>{label}</small><strong>{(coverage.sports||[]).reduce((sum,s)=>sum+(s.layers[key]||0),0).toLocaleString()}</strong></div>)}</div>
   <div className="efCoverageRows">{(coverage.sports||[]).map(s=><article key={s.sport}>
    <strong>{s.sport}</strong>
    <span>{s.coveredByRecords?Object.entries(s.layers).map(([k,n])=>k.replaceAll('_',' ')+' '+n).join(' · '):'No source-backed records'}</span>
    <small>{D(s.lastEvent)}</small>
   </article>)}</div>
   <p className="efChronicleNotice">{coverage.warning}</p>
  </div>}
  <div className="efCoverageBrowse">
   <button disabled={busy||token.length!==64} onClick={()=>void load('scores')} type="button">Browse final-score observations</button>
   <button disabled={busy||token.length!==64} onClick={()=>void load('plays')} type="button">Browse licensed play events</button>
  </div>
  {history&&<div className="efCoverageRows">
   <p>{history.entries?.length||0} {view==='scores'?'score':'play'} observations</p>
   {(history.entries||[]).map(r=><article key={r.id}>
    <strong>{r.sport} · {r.source}</strong>
    <span>{view==='scores'?(r.awayName||'Away')+' '+String(r.awayScore??'—')+' – '+(r.homeName||'Home')+' '+String(r.homeScore??'—'):r.description||'No event detail'}</span>
    <small>{D(r.scheduledAt||r.eventTime)} · {r.verification.replaceAll('_',' ')}</small>
   </article>)}
   <p className="efChronicleNotice">{history.warning}</p>
  </div>}
  {coverage?.sourceScoreWritesEnabled&&<div className="efCoverageCapture">
   <p>Manually collect one permitted league/date of final-score observations. Only the previous 14 days; maximum one collection per league per 10 minutes.</p>
   <label>League<select value={feedId} onChange={e=>setFeedId(e.target.value)}>
    {['nfl','ncaaf','nba','wnba','mlb','nhl','mls','epl','ufc'].map(x=><option value={x} key={x}>{x.toUpperCase()}</option>)}
   </select></label>
   <label>Date<input type="date" aria-label="Date to collect" value={day} onChange={e=>setDay(e.target.value)}/></label>
   <button type="button" disabled={busy||!day||token.length!==64} onClick={()=>void collect()}>Collect selected date</button>
  </div>}
  {capture&&<p role="status" className="efWarehouseNotice">{capture}</p>}
  {error&&<p role="alert" className="efChronicleAlert">{error}</p>}
  <p className="efWarehouseFooter">Registered leagues do not prove complete history. Single-source FINAL observations and operator-imported play data are not independently certified; actual model accuracy must be tested against validated settled outcomes.</p>
 </section>;
}
