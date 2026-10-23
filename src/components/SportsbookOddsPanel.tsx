'use client';
import {useEffect,useMemo,useState} from 'react';

type Quote={sport:string;league:string;event:string;selection:string;market:string;
 odds:number;sourceBook:string;sourceProviderId:string;startTime:string;
 sourceAgeMin:number;quoteProvenance?:string};
type Result={ok:boolean;mode?:string;source?:string;rows:Quote[];
 draftKingsQuotes?:number;totalFreshQuotes?:number;error?:string;warning?:string;
 attempts?:Array<{providerId:string;ok:boolean;error?:string;status?:number;latencyMs?:number;qualityGrade?:string;qualityScore?:number;acceptedMarkets?:number;skipped?:boolean;quotaRemaining?:number;quotaUsed?:number;quotaLastCost?:number}>;
 providerPanel?:Array<{providerId:string;providerName:string;bookmaker:string;marketRole:string;acceptedMarkets:number;qualityGrade?:string;qualityScore?:number;latencyMs?:number;playerPropRows?:number;teamMarketRows?:number;sports?:string[]}>;
 warnings?:string[];degraded?:boolean;targetBook?:string;rawCount?:number;quality?:{grade:string;qualityScore:number;rowCount:number;payloadAgeMin?:number}};
type ProvidersResult={ok:boolean;configuredProviderCount:number;providers:Array<{id:string;name:string;bookmakerLabel:string;credentialConfigured:boolean;requiresPaidQuota:boolean;classification:string}>;error?:string};
const isQuote=(q:Quote)=>!!q&&typeof q.sourceBook==='string'&&
 Number.isSafeInteger(q.odds)&&Math.abs(q.odds)>=100&&Math.abs(q.odds)<=100000&&
 Number.isFinite(Number(q.sourceAgeMin))&&Number(q.sourceAgeMin)>=0&&
 Number(q.sourceAgeMin)<=15&&Number.isFinite(Date.parse(q.startTime))&&Date.parse(q.startTime)>Date.now();
const prettyOdds=(n:number)=>n>0?'+'+n:String(n);
export default function SportsbookOddsPanel(){
 const [stored,setStored]=useState<Result|null>(null);
 const [providers,setProviders]=useState<ProvidersResult|null>(null);
 const [live,setLive]=useState<Result|null>(null);
 const [busy,setBusy]=useState(false);
 const [ownerToken,setOwnerToken]=useState('');
 const [onlyDraftKings,setOnlyDraftKings]=useState(true);
 const [error,setError]=useState<string|null>(null);
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{let active=true;fetch('/api/sportsbook-odds',{cache:'no-store'})
  .then(async r=>{const d=await r.json() as Result;if(!r.ok)throw Error(d.error||'Stored sportsbook quotes unavailable');return d})
  .then(d=>{if(active)setStored(d)}).catch(e=>{if(active)setStored({ok:false,rows:[],error:e instanceof Error?e.message:'Stored odds unavailable'})});
  return()=>{active=false}},[refresh]);
 useEffect(()=>{let active=true;fetch('/api/sportsbook-odds/providers',{cache:'no-store'})
  .then(async r=>{const data=await r.json() as ProvidersResult;if(!r.ok)throw Error(data.error||'Provider configuration unavailable');return data})
  .then(data=>{if(active)setProviders(data)})
  .catch(()=>{if(active)setProviders(null)});
  return()=>{active=false}},[refresh]);
 const refreshProvider=async()=>{
  if(!/^[a-f0-9]{64}$/i.test(ownerToken.trim())){
   setError('Enter the 64-character owner network token before a metered provider refresh.');return;
  }
  setBusy(true);setError(null);setLive(null);
  try{
   // Operator-initiated only: this existing route may fetch configured
   // providers and spend quota. It is NEVER invoked automatically.
   const response=await fetch('/api/markets?forceLive=1',{cache:'no-store',headers:{Authorization:'Bearer '+ownerToken.trim()}});
   const body=await response.json() as Result&{markets?:Quote[];sportsbookQuotes?:Quote[];warnings?:string[];providerId?:string;source?:string;quoteScope?:string};
   if(!response.ok)throw Error(body.error||'Odds provider refresh failed');
   if(body.source==='demo')throw Error('Only demonstration markets were returned. No live sportsbook quotes are available.');
   // Book-specific observations only; consensus rows may refer to a
   // different bookmaker and cannot masquerade as a DraftKings quote.
   const quotes=(body.sportsbookQuotes||[]).filter(isQuote);
   setLive({ok:true,source:body.source,mode:body.mode,rows:quotes,
    providerPanel:body.providerPanel,rawCount:body.rawCount,targetBook:body.targetBook,degraded:body.degraded,
    totalFreshQuotes:quotes.length,draftKingsQuotes:quotes.filter(q=>q.sourceBook?.trim().toLowerCase()==='draftkings').length,
    warning:(body.warnings||[]).slice(0,5).join(' · ')||'Provider quotes are unverified for ownership, execution and storage rights. No independent probability or EV is implied.',
    attempts:body.attempts});
   setRefresh(x=>x+1);
  }catch(e){setError(e instanceof Error?e.message:'Could not refresh connected sportsbook feeds')}
  finally{setBusy(false)}
 };
 const result=live||stored;
 const all=useMemo(()=>(result?.rows||[]).filter(isQuote),[result]);
 const dk=all.filter(q=>q.sourceBook.trim().toLowerCase()==='draftkings');
 const visible=(onlyDraftKings?dk:all).slice(0,80);
 const quotaExhausted=Boolean(live?.attempts?.some(a=>a.quotaRemaining===0));
 return <section className="coveragePanel" aria-label="Sportsbook odds quotes" style={{padding:22,marginBottom:20}}>
  <div className="coveragePanelHead"><div><div className="eyebrow">SPORTSBOOK ODDS • RESEARCH ONLY</div><h2>DraftKings and reference sportsbook prices</h2></div></div>
  <p className="coverageNote">See real provider-labeled markets when available. The default view reads existing stored snapshots only. The manual refresh targets The Odds API only and is limited to one paid bootstrap request, without retries or paid sport expansions. It never runs automatically. No bookmaker prices are inferred from scores.</p>
  <div className="coverageTools">
   <label>Owner token (not stored) <input aria-label="Owner network token for sportsbook refresh" type="password" autoComplete="off" value={ownerToken} onChange={e=>setOwnerToken(e.target.value)} placeholder="64-character owner token"/></label>
   <button type="button" disabled={busy||quotaExhausted} onClick={refreshProvider}>{busy?'Contacting providers…':quotaExhausted?'Refresh blocked: provider reports zero credits':'Refresh DraftKings odds (one provider request; may use quota)'}</button>
   <button type="button" onClick={()=>{setLive(null);setError(null);setRefresh(x=>x+1)}}>Stored prices only</button>
   <label><input aria-label="Show DraftKings only" type="checkbox" checked={onlyDraftKings} onChange={e=>setOnlyDraftKings(e.target.checked)}/> DraftKings only</label>
  </div>
  <div className="coverageKpis">
   <article><small>FRESH DRAFTKINGS QUOTES</small><strong>{dk.length}</strong><span>Displayed prices; not authenticated/executable</span></article>
   <article><small>ALL SPORTSBOOK QUOTES</small><strong>{all.length}</strong><span>Quotes from {live?'operator-requested provider scan':'stored snapshots'}</span></article>
   <article><small>DATA STATUS</small><strong style={{fontSize:'1.1rem'}}>{live?.source==='live'?'Provider response':live?.source==='stored'?'Stored fallback':stored?.ok?'Stored research':'Unavailable'}</strong><span>Neither a certified model nor an +EV guarantee</span></article>
  </div>
  {providers?.ok&&<div aria-label="Odds provider configuration diagnostics">
   <p className="coverageNote">Configured odds adapters: {providers.configuredProviderCount}. Configuration does not mean the adapter returned usable prices. No live calls are made by this check.</p>
   <div className="coverageTableWrap"><table><thead><tr><th>Provider</th><th>Feed type</th><th>Credentials</th></tr></thead>
   <tbody>{providers.providers.map(p=><tr key={p.id}><td>{p.name}</td>
    <td>{p.classification==='PUBLIC_REFERENCE_ODDS'?'Public reference odds':'Configured odds adapter'}</td>
    <td>{p.credentialConfigured?'Key present':'No key on provider config / key not required'}</td></tr>)}</tbody></table></div>
  </div>}
  {live?.providerPanel?.length?<div aria-label="Accepted odds market detail" className="coverageTableWrap">
   <p className="coverageNote">Target bookmaker: {live.targetBook||'DraftKings'} · raw provider rows: {live.rawCount??'unknown'} · overall provider mode: {live.degraded?'DEGRADED':'NORMAL'}.</p>
   <table><thead><tr><th>Feed</th><th>Book label</th><th>Accepted markets</th><th>Sport/prop coverage</th><th>Quality</th><th>Latency</th></tr></thead><tbody>
    {live.providerPanel.map(p=><tr key={p.providerId}><td>{p.providerName}</td><td>{p.bookmaker}</td>
     <td>{p.acceptedMarkets}</td><td>{p.sports?.join(', ')||'No accepted markets'} · props {p.playerPropRows??0}</td>
     <td>{p.qualityGrade||'Not scored'}{typeof p.qualityScore==='number'?' ('+(p.qualityScore*100).toFixed(0)+'%)':''}</td>
     <td>{typeof p.latencyMs==='number'?p.latencyMs+' ms':'—'}</td></tr>)}
   </tbody></table>
  </div>:null}
  {live?.attempts?.length?<div aria-label="Odds provider response diagnostics" className="coverageTableWrap">
   <table><thead><tr><th>Provider attempted</th><th>HTTP</th><th>Result</th><th>Accepted markets</th><th>Credits left</th><th>Credits used</th><th>Last request cost</th><th>Reason</th></tr></thead><tbody>
    {live.attempts.map((a,i)=><tr key={a.providerId+'-'+i}><td>{a.providerId}</td>
     <td>{a.status??'No response'}</td><td>{a.ok?'Accepted':a.skipped?'Skipped':'Rejected'}</td><td>{a.acceptedMarkets??0}</td><td>{a.quotaRemaining??'Not reported'}</td><td>{a.quotaUsed??'Not reported'}</td><td>{a.quotaLastCost??'Not reported'}</td><td>{a.error||'—'}</td></tr>)}
   </tbody></table>
  </div>:null}
  {quotaExhausted&&<p role="alert" className="coverageNote">The provider reported zero remaining credits. Another paid refresh is blocked in this panel until you explicitly reset the state or update provider quota information.</p>}
  {error&&<p role="alert" className="coverageNote">{error}</p>}
  {result&&!result.ok&&<p role="alert" className="coverageNote">{result.error||'Unable to read sportsbook snapshots'}</p>}
  {live?.ok&&live.rows.length===0&&<p className="coverageNote">The provider scan returned no fresh, bookmaker-specific quotes (the combined market or consensus board may still contain entries). Inspect each provider attempt above; a reference price cannot be shown as a DraftKings quote.</p>}
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
