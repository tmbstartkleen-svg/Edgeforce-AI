'use client';
import {useEffect,useMemo,useState} from 'react';

type Quote={sport:string;league:string;event:string;selection:string;market:string;
 odds:number;sourceBook:string;sourceProviderId:string;startTime:string;
 sourceAgeMin:number;quoteProvenance?:string};
type Result={ok:boolean;mode?:string;source?:string;rows:Quote[];
 draftKingsQuotes?:number;totalFreshQuotes?:number;error?:string;warning?:string;
 attempts?:Array<{providerId:string;ok:boolean;error?:string}>};
const isQuote=(q:Quote)=>!!q&&typeof q.sourceBook==='string'&&
 Number.isSafeInteger(q.odds)&&Math.abs(q.odds)>=100&&Math.abs(q.odds)<=100000&&
 Number.isFinite(Number(q.sourceAgeMin))&&Number(q.sourceAgeMin)>=0&&
 Number(q.sourceAgeMin)<=15&&Number.isFinite(Date.parse(q.startTime))&&Date.parse(q.startTime)>Date.now();
const prettyOdds=(n:number)=>n>0?'+'+n:String(n);
export default function SportsbookOddsPanel(){
 const [stored,setStored]=useState<Result|null>(null);
 const [live,setLive]=useState<Result|null>(null);
 const [busy,setBusy]=useState(false);
 const [onlyDraftKings,setOnlyDraftKings]=useState(true);
 const [error,setError]=useState<string|null>(null);
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{let active=true;fetch('/api/sportsbook-odds',{cache:'no-store'})
  .then(async r=>{const d=await r.json() as Result;if(!r.ok)throw Error(d.error||'Stored sportsbook quotes unavailable');return d})
  .then(d=>{if(active)setStored(d)}).catch(e=>{if(active)setStored({ok:false,rows:[],error:e instanceof Error?e.message:'Stored odds unavailable'})});
  return()=>{active=false}},[refresh]);
 const refreshProvider=async()=>{
  setBusy(true);setError(null);setLive(null);
  try{
   // Operator-initiated only: this existing route may fetch configured
   // providers and spend quota. It is NEVER invoked automatically.
   const response=await fetch('/api/markets',{cache:'no-store'});
   const body=await response.json() as Result&{markets?:Quote[];warnings?:string[];providerId?:string;source?:string};
   if(!response.ok)throw Error(body.error||'Odds provider refresh failed');
   if(body.source==='demo')throw Error('Only demonstration markets were returned. No live sportsbook quotes are available.');
   const quotes=(body.markets||[]).filter(isQuote);
   setLive({ok:true,source:body.source,mode:body.mode,rows:quotes,
    totalFreshQuotes:quotes.length,draftKingsQuotes:quotes.filter(q=>q.sourceBook?.trim().toLowerCase()==='draftkings').length,
    warning:'Provider data is unverified for storage rights, independent provenance, and execution. Research only.',
    attempts:body.attempts});
   setRefresh(x=>x+1);
  }catch(e){setError(e instanceof Error?e.message:'Could not refresh connected sportsbook feeds')}
  finally{setBusy(false)}
 };
 const result=live||stored;
 const all=useMemo(()=>(result?.rows||[]).filter(isQuote),[result]);
 const dk=all.filter(q=>q.sourceBook.trim().toLowerCase()==='draftkings');
 const visible=(onlyDraftKings?dk:all).slice(0,80);
 return <section className="coveragePanel" aria-label="Sportsbook odds quotes" style={{padding:22,marginBottom:20}}>
  <div className="coveragePanelHead"><div><div className="eyebrow">SPORTSBOOK ODDS • RESEARCH ONLY</div><h2>DraftKings and reference sportsbook prices</h2></div></div>
  <p className="coverageNote">See real provider-labeled markets when available. The default view reads existing stored snapshots only. The manual provider refresh may consume API quota and is never started automatically. No bookmaker prices are inferred from scores.</p>
  <div className="coverageTools">
   <button type="button" disabled={busy} onClick={refreshProvider}>{busy?'Contacting providers…':'Refresh connected odds providers (may use quota)'}</button>
   <button type="button" onClick={()=>{setLive(null);setError(null);setRefresh(x=>x+1)}}>Stored prices only</button>
   <label><input aria-label="Show DraftKings only" type="checkbox" checked={onlyDraftKings} onChange={e=>setOnlyDraftKings(e.target.checked)}/> DraftKings only</label>
  </div>
  <div className="coverageKpis">
   <article><small>FRESH DRAFTKINGS QUOTES</small><strong>{dk.length}</strong><span>Displayed prices; not authenticated/executable</span></article>
   <article><small>ALL SPORTSBOOK QUOTES</small><strong>{all.length}</strong><span>Quotes from {live?'operator-requested provider scan':'stored snapshots'}</span></article>
   <article><small>DATA STATUS</small><strong style={{fontSize:'1.1rem'}}>{live?.source==='live'?'Provider response':live?.source==='stored'?'Stored fallback':stored?.ok?'Stored research':'Unavailable'}</strong><span>Neither a certified model nor an +EV guarantee</span></article>
  </div>
  {error&&<p role="alert" className="coverageNote">{error}</p>}
  {result&&!result.ok&&<p role="alert" className="coverageNote">{result.error||'Unable to read sportsbook snapshots'}</p>}
  {result?.ok&&all.length===0&&<p className="coverageNote">No current sportsbook quotes are available from this data path. The D1 score feed is not an odds provider. Check whether an approved sportsbook adapter is configured and whether stored snapshots are within 15 minutes of collection.</p>}
  {all.length>0&&dk.length===0&&onlyDraftKings&&<p className="coverageNote">Other bookmaker prices were found, but none is identified as DraftKings. Turn off the DraftKings filter to inspect them; do not relabel reference prices as DraftKings.</p>}
  {visible.length>0&&<div className="coverageTableWrap"><table><thead><tr><th>Sport / League</th><th>Game</th><th>Market / Selection</th><th>American odds</th><th>Book</th><th>Provider</th><th>Age</th></tr></thead><tbody>
   {visible.map((q,i)=><tr key={q.sourceProviderId+'|'+q.event+'|'+q.market+'|'+q.selection+'|'+i}>
    <td>{q.sport} / {q.league}</td><td>{q.event}</td><td>{q.market}: {q.selection}</td>
    <td><strong>{prettyOdds(q.odds)}</strong></td><td>{q.sourceBook}</td><td>{q.sourceProviderId}</td><td>{Math.round(q.sourceAgeMin)} min</td>
   </tr>)}</tbody></table></div>}
  {result?.warning&&<p className="coverageNote">{result.warning}</p>}
  <p className="coverageNote">No source-rights verification, independent player probability, positive expected value, confirmed availability or automated betting eligibility is implied by these quotes.</p>
 </section>;
}
