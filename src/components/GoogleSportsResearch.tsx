'use client';
import {useState} from 'react';

type Game={
 id:string;league:string;status:string;statusDetail:string;startTime:string;observedAt:string;
 teamA:{name:string;score:number|null};teamB:{name:string;score:number|null};
 homeAwayConfirmed:false;
};
type GoogleResearch={
 ok:boolean;status:string;source:string;dataRole:string;configured:boolean;enabled:boolean;
 target?:string;games:Game[];sourceObservedAt?:string;lastFetchedAt?:string;
 remainingAttemptBudget?:number;retryAfterSeconds?:number;warning?:string;
};
const showTime=(s:string)=>{const date=new Date(s);return Number.isFinite(date.getTime())?date.toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):'Date not verified'};

export default function GoogleSportsResearch(){
 const [payload,setPayload]=useState<GoogleResearch|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const load=async()=>{
  setLoading(true);setError('');
  try{
   const response=await fetch('/api/research/google-sports',{cache:'no-store'});
   const data=await response.json() as GoogleResearch;
   setPayload(data);
   if(!response.ok)setError('Research feed unavailable; no additional requests will be triggered automatically.');
  }catch{
   setError('Could not load Google Sports research. No automatic retry was scheduled.');
  }finally{setLoading(false)}
 };
 return <section className="efGoogleResearch" aria-label="Google Sports research">
  <div className="efGoogleResearchHead">
   <div>
    <span className="efKicker">SUPPLEMENTAL INTELLIGENCE / SERPAPI</span>
    <h3>Google Sports research</h3>
    <p>League schedules and scoreboard context from Google via SerpApi. Only fetched on demand, with a shared free-plan request limit.</p>
   </div>
   <button type="button" disabled={loading} onClick={()=>void load()}>{loading?'Checking…':payload?'Check saved research':'Load Google Sports research'}</button>
  </div>
  {(payload||error)&&<div className="efGoogleResearchStatus" role="status">
   <b>{payload?.status?.replaceAll('_',' ')||'NETWORK UNAVAILABLE'}</b>
   <span>{payload?.target?'League: '+payload.target+' · ':''}{payload?.sourceObservedAt?'Source record: '+showTime(payload.sourceObservedAt):'Not verified as a live data feed'}</span>
   {payload?.remainingAttemptBudget!==undefined&&<span>Shared research attempts remaining: {payload.remainingAttemptBudget} (conservative cap)</span>}
   <p>{error||payload?.warning||'Research only. No prices or bets are certified from this feed.'}</p>
   {payload?.status==='KEY_MISSING'&&<p>Set SERPAPI_API_KEY as a Cloudflare secret, and SERPAPI_SPORTS_ENABLED=true as a variable.</p>}
   {payload?.status==='TARGETS_MISSING'&&<p>Configure verified league Knowledge Graph IDs under SERPAPI_SPORTS_TARGETS_JSON.</p>}
   {payload?.status==='DISABLED'&&<p>Google Sports research is intentionally off until explicitly enabled in the Worker configuration.</p>}
  </div>}
  {payload?.games?.length>0&&<div className="efGoogleResearchGames">
   {payload.games.slice(0,24).map(game=><article key={game.id}>
    <div><small>{game.league}</small><small>{showTime(game.startTime)}</small></div>
    <h4>{game.teamA.name} <span>vs.</span> {game.teamB.name}</h4>
    <p>{game.statusDetail} · {game.status}</p>
    <strong>{game.teamA.score===null?'—':game.teamA.score} : {game.teamB.score===null?'—':game.teamB.score}</strong>
   </article>)}
  </div>}
  {payload?.ok&&!payload.games.length&&<p className="efGoogleResearchNote">No supported matchups were available for this configured league and the current source response.</p>}
  <p className="efGoogleResearchFoot">Research source only. Google’s team ordering does not certify home/away; games are not merged into live trading, sportsbook odds, player-prop pricing or betting execution. Free SerpApi searches are limited and cannot deliver sub-second coverage.</p>
 </section>;
}
