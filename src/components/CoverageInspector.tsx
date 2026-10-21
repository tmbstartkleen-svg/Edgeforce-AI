'use client';
import {useState} from 'react';
type League={sport:string;league:string;events:number;marketTypes:number;expected:number;matched:number;missing:number};
type Report={ok:true;mode:string;totals:{sports:number;leagues:number;events:number;outcomes:number;expected:number;matched:number;missing:number};leagues:League[];providers:{name:string;state:string}[];missingMarkets:{target:{sport:string;league:string;eventId:string;marketType:string;outcomeId:string};reason:string}[];coverageComplete:boolean};
type StoredCoverage={ok:true;mode:string;asOf:string;freshDraftKingsQuotes:number;rowsInspected:number;unrecognizedRows:number;missingMarketCount:null;leagues:{sport:string;league:string;events:number;marketTypes:number;players:number;quotes:number}[];independentVerification:{independentUpstreams:number;crossProviderVerified:boolean}};
export default function CoverageInspector(){
 const [stored,setStored]=useState<StoredCoverage|null>(null);
 const [token,setToken]=useState(''),[snapshot,setSnapshot]=useState(''),[report,setReport]=useState<Report|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const loadStored=async()=>{
  setError('');setStored(null);
  if(!token.trim()){setError('Enter the Founder network token to read stored coverage.');return;}
  setBusy(true);
  try{
   const response=await fetch('/api/operations/d1-pilot/coverage',{cache:'no-store',headers:{Authorization:'Bearer '+token.trim()}});
   const data=await response.json() as StoredCoverage&{error?:string};
   if(!response.ok||!data.ok)throw new Error(data.error||'Stored coverage unavailable');
   setStored(data);
  }catch(e){setError(e instanceof Error?e.message:'Unable to load stored coverage');}
  finally{setBusy(false);}
 };
 const inspect=async()=>{
  setError('');setReport(null);
  if(!token.trim()||!snapshot.trim()){setError('Provide the Founder network token and a licensed provider snapshot.');return;}
  let catalogs:unknown;
  try{catalogs=JSON.parse(snapshot);}catch{setError('Snapshot must be valid JSON.');return;}
  if(!Array.isArray(catalogs)){setError('Enter a JSON array of provider catalogs.');return;}
  setBusy(true);
  try{
   const response=await fetch('/api/network/v1/coverage',{method:'POST',cache:'no-store',headers:{Authorization:'Bearer '+token.trim(),'Content-Type':'application/json'},body:JSON.stringify({catalogs,bookmaker:'DraftKings',asOf:new Date().toISOString(),maxAgeMs:900000})});
   const data=await response.json() as Report&{error?:string};
   if(!response.ok||!data.ok)throw new Error(data.error||'Coverage analysis unavailable');
   setReport(data);
  }catch(e){setError(e instanceof Error?e.message:'Coverage analysis unavailable');}
  finally{setBusy(false);}
 };
 return <section style={{padding:'24px',maxWidth:1150,margin:'0 auto',color:'#e6f1f6'}}>
  <h1 style={{fontSize:30,marginBottom:8}}>All-Sports Coverage Inspector</h1>
  <p style={{fontSize:16,lineHeight:1.5,color:'#bed0db'}}>Analyze a licensed provider snapshot. This is <strong>not a live DraftKings feed</strong>; absent data is unknown, not proof that the market is unavailable.</p>
  <label style={{display:'block',marginTop:20}}>Founder network token
   <input type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} style={{display:'block',width:'100%',padding:13,marginTop:6,color:'#101923'}}/>
  </label>
  <button type="button" disabled={busy} onClick={loadStored} style={{padding:'13px 20px',marginTop:16,background:'#b3e4cb',color:'#101923',fontWeight:700,border:0,cursor:'pointer'}}>Load current D1 observations</button>
  {stored&&<section aria-live="polite" style={{padding:16,border:'1px solid #425463',marginTop:20}}><h2 style={{fontSize:22}}>Persisted odds coverage</h2><p>Fresh DraftKings quotes: {stored.freshDraftKingsQuotes} · Inspected records: {stored.rowsInspected} · Unrecognized: {stored.unrecognizedRows}</p><p>Independent upstreams: {stored.independentVerification.independentUpstreams} · Cross-book consensus: not established</p><ul>{stored.leagues.map((l,i)=><li key={l.sport+'|'+l.league+'|'+i}>{l.sport} / {l.league}: {l.events} events, {l.quotes} quotes, {l.players} players</li>)}</ul><p>Complete DraftKings catalog: unknown — no independent target catalog available.</p></section>}
  <label style={{display:'block',marginTop:16}}>Provider catalogs (JSON array)
   <textarea rows={9} value={snapshot} onChange={e=>setSnapshot(e.target.value)} placeholder={'[{"provider":"authorized-provider","fetchedAt":"2026-10-21T12:00:00Z","events":[]}]'} style={{display:'block',width:'100%',padding:13,marginTop:6,color:'#101923',fontFamily:'monospace'}}/>
  </label>
  <button type="button" disabled={busy} onClick={inspect} style={{padding:'13px 20px',marginTop:16,background:'#c4f46e',color:'#101923',fontWeight:700,border:0,cursor:'pointer'}}>{busy?'Analyzing…':'Analyze licensed snapshot'}</button>
  {error&&<p role="alert" style={{color:'#ffb8b8'}}>{error}</p>}
  {report&&<section aria-live="polite" style={{marginTop:28}}>
   <h2 style={{fontSize:23}}>Observed coverage — {report.mode}</h2>
   <p>Sports: {report.totals.sports} · Leagues: {report.totals.leagues} · Events: {report.totals.events} · Outcomes: {report.totals.outcomes} · Matched: {report.totals.matched} · Missing from supplied catalog: {report.totals.missing}</p>
   <p style={{color:'#bed0db'}}>Source freshness: {report.providers.map(p=>p.name+' ('+p.state+')').join(', ')||'No provider data'} · Catalog complete: {report.coverageComplete?'For supplied inventory only':'No'}</p>
   <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}>
    <thead><tr>{['Sport','League','Events','Market types','Matched','Missing'].map(s=><th key={s} style={{padding:10,borderBottom:'1px solid #425463'}}>{s}</th>)}</tr></thead>
    <tbody>{report.leagues.map((l,i)=><tr key={l.sport+'|'+l.league+'|'+i}><td style={{padding:10}}>{l.sport}</td><td>{l.league}</td><td>{l.events}</td><td>{l.marketTypes}</td><td>{l.matched}</td><td>{l.missing}</td></tr>)}</tbody>
   </table></div>
   <h3 style={{fontSize:19,marginTop:22}}>Missing from supplied inventory</h3>
   {report.missingMarkets.length===0?<p>No unmatched targets in this snapshot. This does not establish full sportsbook coverage.</p>:<ul>{report.missingMarkets.slice(0,100).map((m,i)=><li key={i}>{m.target.sport} / {m.target.league} / {m.target.marketType} / {m.target.outcomeId}: {m.reason}</li>)}</ul>}
  </section>}
 </section>;
}
