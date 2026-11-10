'use client';

import {useEffect,useState} from 'react';

type Athlete={id:string;name:string;sport?:string;team?:string};
type Window={observed:number;hits:number;hitRate:number|null;complete:boolean;values:number[]};
type Streak={
  status:string;verifiedGames:number;consecutive:number;modelProbability:null;
  last5:Window;last10:Window;
  warnings:string[];
  games:Array<{eventId:string;date:string;value:number;sourceUrl?:string|null}>;
};
type Result={
  ok:boolean;player?:Athlete;dataSource?:string;archivedRows?:number;
  excludedArchiveRows?:Array<{eventId:string|null;reasons:string[]}>;
  sourceAuthenticated?:boolean;independentForecastAvailable?:boolean;
  streak?:Streak;status?:string;error?:string;caveat?:string;
};
const categories=['points','rebounds','assists','steals','blocks','turnovers',
  'threepointers','passingyards','passingtds','rushingyards','receivingyards',
  'receptions','shotsongoal','saves','goals','strikeouts','homeruns'] as const;
const pct=(n:number|null)=>n===null?'Incomplete sample':(n*100).toFixed(1)+'%';
function Sample({title,window}: {title:string;window:Window}){
 return <div className="v21Card" style={{minWidth:170,flex:'1 1 170px'}}>
  <h4>{title}</h4>
  <strong>{window.hits} / {window.observed} hits</strong>
  <p>{pct(window.hitRate)}</p>
  {!window.complete&&<small>Not enough qualifying games for a full-window rate</small>}
 </div>;
}
export default function PlayerStreakResearchPanel(){
 const [directory,setDirectory]=useState<Athlete[]>([]);
 const [directorySource,setDirectorySource]=useState('UNAVAILABLE');
 const [playerId,setPlayerId]=useState('');
 const [stat,setStat]=useState<string>('assists');
 const [threshold,setThreshold]=useState('6');
 const [result,setResult]=useState<Result|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  const controller=new AbortController();
  fetch('/api/players?limit=100',{cache:'no-store',signal:controller.signal})
   .then(r=>r.ok?r.json():Promise.reject(new Error('PLAYER_DIRECTORY_UNAVAILABLE')))
   .then(x=>{
     if(controller.signal.aborted)return;
     const players=Array.isArray(x.players)?x.players.filter(
       (p:Athlete)=>typeof p?.id==='string'&&typeof p?.name==='string'):[] as Athlete[];
     setDirectory(players);
     setDirectorySource(x.source==='database'?'STORED PLAYER DIRECTORY':'DEMO / UNVERIFIED DIRECTORY');
   }).catch(()=>{if(!controller.signal.aborted)setDirectorySource('UNAVAILABLE')});
  return()=>controller.abort();
 },[]);
 async function load(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!playerId.trim())return;
  const value=Number(threshold);
  if(!Number.isFinite(value)||value<0||value>10000){setError('Enter a valid threshold between 0 and 10000.');return;}
  setBusy(true);setResult(null);setError('');
  const query=new URLSearchParams({stat,threshold:String(value)});
  try{
   const response=await fetch('/api/player/'+encodeURIComponent(playerId.trim())+'/streak?'+query,{
     cache:'no-store'
   });
   const data:Result=await response.json();
   if(!response.ok||!data.ok){setError(data.status||data.error||'Streak evidence unavailable.');return;}
   setResult(data);
  }catch{setError('Streak research is unavailable. Check the player archive connection.')}
  finally{setBusy(false);}
 }
 return <section className="v21Card" aria-label="Verified player streak research">
  <div className="v21CardHead">
   <div><div className="eyebrow">EDGEFORCE · HISTORICAL PLAYER RESEARCH</div><h3>Last 5 / Last 10 player streaks</h3></div>
   <span>READ-ONLY</span>
  </div>
  <p className="muted">Inspect observed player performances from archived games. This panel never estimates the probability of a future bet, calls a sportsbook, or places a wager.</p>
  <form onSubmit={load} style={{display:'flex',gap:12,alignItems:'end',flexWrap:'wrap'}}>
   <label>Stored player
    <select aria-label="Stored player" value={playerId} onChange={e=>{setPlayerId(e.target.value);setResult(null);}}>
     <option value="">Select player</option>
     {directory.map(p=><option key={p.id} value={p.id}>{p.name} · {p.sport||'Sport unavailable'} · {p.team||'Team unavailable'}</option>)}
    </select>
   </label>
   <label>Statistic
    <select value={stat} onChange={e=>setStat(e.target.value)}>
     {categories.map(s=><option key={s} value={s}>{s}</option>)}
    </select>
   </label>
   <label>At least
    <input type="number" min="0" max="10000" step="0.5" value={threshold} onChange={e=>setThreshold(e.target.value)} required style={{maxWidth:120}}/>
   </label>
   <button type="submit" disabled={busy||!playerId}>{busy?'Reviewing…':'Inspect game logs'}</button>
  </form>
  <p className="muted"><small>Directory: {directorySource}. Stored IDs are required; demo players cannot produce verified history.</small></p>
  {error&&<p role="alert">{error}</p>}
  {result?.streak&&<>
   <p><strong>{result.player?.name||playerId}</strong> · {stat} ≥ {threshold} · <strong>{result.streak.status.replaceAll('_',' ')}</strong></p>
   <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
    <Sample title="Last five" window={result.streak.last5}/>
    <Sample title="Last ten" window={result.streak.last10}/>
    <div className="v21Card" style={{minWidth:170,flex:'1 1 170px'}}>
     <h4>Consecutive hits</h4>
     <strong>{result.streak.consecutive}</strong>
     <p>{result.streak.verifiedGames} eligible historical games</p>
    </div>
   </div>
   <p className="muted">Archived rows: {result.archivedRows??0} · Excluded for insufficient evidence: {result.excludedArchiveRows?.length??0}. Source identity not independently authenticated.</p>
   <div className="tableWrap">
    <table><thead><tr><th>Date (UTC)</th><th>Game ID</th><th>Observed {stat}</th><th>Reference</th></tr></thead>
     <tbody>{result.streak.games.map(g=><tr key={g.eventId}>
      <td>{g.date.slice(0,10)}</td><td>{g.eventId}</td><td>{g.value}</td>
      <td>{g.sourceUrl?<a href={g.sourceUrl} target="_blank" rel="noreferrer noopener">Event page</a>:'Not available'}</td>
     </tr>)}</tbody>
    </table>
   </div>
   <p className="muted">{result.caveat} No market probability, edge, or recommended wager is generated here.</p>
  </>}
 </section>;
}
