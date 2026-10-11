'use client';
import {useState} from 'react';

type Fixture={
 id:number;league:string;startTime:string;status:string;elapsed:number|null;
 home:{name:string;score:number|null};away:{name:string;score:number|null};
};
type Research={
 ok:boolean;status:string;enabled:boolean;configured:boolean;
 league?:string;fixtures:Fixture[];lastFetchedAt?:string;truncated?:boolean;
 remainingLocalBudget?:number;providerRemaining?:number|null;
 warning?:string;dailyFreeBudgetCap?:number;
};
const dateLabel=(v:string)=>{
 const d=new Date(v);
 return Number.isFinite(d.getTime())?d.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Unconfirmed';
};
export default function ApiFootballResearch(){
 const [value,setValue]=useState<Research|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const load=async()=>{
  setLoading(true);setError('');
  try{
   const res=await fetch('/api/research/api-football',{cache:'no-store'});
   const data=await res.json() as Research;
   setValue(data);
   if(!res.ok)setError('The supplemental soccer source is unavailable or the shared quota check failed.');
  }catch{setError('Could not load API-Football. No automatic retry will be made.')}
  finally{setLoading(false)}
 };
 return <section className="efGoogleResearch efFootballResearch" aria-label="API-Football free research">
  <div className="efGoogleResearchHead"><div>
   <span className="efKicker">SOCCER RESEARCH / API-FOOTBALL V3</span>
   <h3>API-Football · Free account</h3>
   <p>Fixtures, scores and game-state research from your existing API-Football account. This view makes no requests until you tap Load.</p>
  </div>
   <button type="button" disabled={loading} onClick={()=>void load()}>{loading?'Checking…':'Load soccer research'}</button>
  </div>
  {value&&<div className="efGoogleResearchStatus" role="status">
   <b>{value.status.replaceAll('_',' ')}</b>
   <span>{value.league||'Soccer feed'} · Local cap {value.dailyFreeBudgetCap??48} attempts/day</span>
   {value.lastFetchedAt&&<span>Retrieved {dateLabel(value.lastFetchedAt)}</span>}
   {value.remainingLocalBudget!==undefined&&<span>Locally remaining today: {value.remainingLocalBudget}</span>}
   {value.providerRemaining!==null&&value.providerRemaining!==undefined&&<span>Vendor-reported remaining: {value.providerRemaining}</span>}
   <p>{value.warning||'Supplemental research only.'}</p>
   {value.status==='DISABLED'&&<p>Enable API_FOOTBALL_RESEARCH_ENABLED=true in Cloudflare Variables.</p>}
   {value.status==='KEY_MISSING'&&<p>Set API_SPORTS_KEY or API_FOOTBALL_KEY as a Cloudflare encrypted secret. Do not put your key in chat.</p>}
   {value.truncated&&<p>The vendor response has more than one page; the free-budget mode intentionally does not fetch extra pages.</p>}
  </div>}
  {error&&<div className="efGoogleResearchStatus" role="alert">{error}</div>}
  {value&&value.fixtures.length>0&&<div className="efGoogleResearchGames">
   {value.fixtures.slice(0,24).map(x=><article key={x.id}>
    <div><small>{x.league}</small><small>{dateLabel(x.startTime)}</small></div>
    <h4>{x.away.name} <span>at</span> {x.home.name}</h4>
    <p>Status {x.status}{x.elapsed===null?'':' · minute '+x.elapsed}</p>
    <strong>{x.away.score===null?'—':x.away.score} : {x.home.score===null?'—':x.home.score}</strong>
   </article>)}
  </div>}
  {value?.ok&&value.fixtures.length===0&&<p className="efGoogleResearchNote">No fixtures were returned for this configured league/date. Other leagues rotate through the shared budget.</p>}
  <p className="efGoogleResearchFoot">API-Football covers soccer, not American college football. Free-plan research may be incomplete or delayed. These scores do not replace verified sportsbook prices, and this view does not clear the one-odds-provider trading warning.</p>
 </section>;
}
