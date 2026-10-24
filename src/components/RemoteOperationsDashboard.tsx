'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import './remote-operations-dashboard.css';
import PredictionArbitrageStudio from './PredictionArbitrageStudio';
type Summary={total:number;recent:number;draftKingsRecent:number;independentProvidersRecent:number;mostRecentAt?:string|null};
type MarketRow={sport:string;bookmaker:string;provider:string;quote_count:number;most_recent_at:string};
type AgentRow={agent_id:string;status:string;count:number;most_recent_at:string};
type OpportunityReview={ok:boolean;status?:string;error?:string;verified?:{acceptedQuotes:number;rowsExamined:number;rejections:Record<string,number>};opportunities?:{opportunities:{eventId:string;marketKey:string;theoreticalRoiPct:number;status:string;stakes:{bookmaker:string;selection:string;odds:number}[]}[];evaluatedGroups:number};modelVerifiedEdges?:unknown[]};
type Snapshot={ok:boolean;status:string;reason?:string;error?:string;generatedAt?:string;build?:string|number;
 blockers?:string[];summary?:Summary;providers?:{id:string;name:string;bookmaker:string;enabled:boolean;credentialConfigured:boolean|null}[];
 marketSummary?:MarketRow[];agentSummary?:AgentRow[];readOnly?:boolean;oddsApiCalls?:number;notes?:string[]};
function displayTime(s?:string|null){if(!s)return 'Unavailable';const d=new Date(s);return Number.isFinite(d.getTime())?d.toLocaleString():'Unavailable'}
export default function RemoteOperationsDashboard(){
 const [token,setToken]=useState('');const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [error,setError]=useState('');const [loading,setLoading]=useState(false);
 const [opportunityData,setOpportunityData]=useState<OpportunityReview|null>(null);const [opportunityError,setOpportunityError]=useState('');const [opportunityLoading,setOpportunityLoading]=useState(false);
 const [sport,setSport]=useState('ALL');const [view,setView]=useState<'overview'|'markets'|'agents'|'opportunities'|'prediction-arbs'>('overview');
 const loadOpportunities=useCallback(async()=>{
  if(!token)return;setOpportunityLoading(true);setOpportunityError('');
  try{const response=await fetch('/api/operations/sportsbook-opportunities',{headers:{authorization:'Bearer '+token},cache:'no-store'});
   const data:OpportunityReview=await response.json();if(!response.ok||!data.ok){setOpportunityError(data.error||'D1 opportunity review unavailable');setOpportunityData(null)}else setOpportunityData(data);
  }catch{setOpportunityError('Cannot reach the archived-odds review endpoint.');setOpportunityData(null)}finally{setOpportunityLoading(false)}
 },[token]);
 const refresh=useCallback(async()=>{
  if(!token.trim()){setError('Enter the authorized operator token to load private operations data.');return}
  setLoading(true);setError('');
  try{
   const response=await fetch('/api/operations/remote-dashboard',{headers:{authorization:'Bearer '+token},cache:'no-store'});
   const data:Snapshot=await response.json();
   if(!response.ok||!data.ok){setError(response.status===401?'Operator token was not accepted.':(data.error||data.reason||'Dashboard temporarily unavailable'));setSnapshot(null)}
   else setSnapshot(data);
  }catch{setError('Unable to reach EdgeForce dashboard API.');setSnapshot(null)}finally{setLoading(false)}
 },[token]);
 useEffect(()=>{if(!token||!snapshot)return;const t=setInterval(()=>{void refresh()},60000);return()=>clearInterval(t)},[token,snapshot,refresh]);

 const sports=[...new Set((snapshot?.marketSummary||[]).map(x=>x.sport))].sort();
 const markets=(snapshot?.marketSummary||[]).filter(x=>sport==='ALL'||x.sport===sport);
 const stale=!snapshot?.summary?.recent;
 return <div className="efops-app">
  <aside className="efops-side"><div className="efops-brand"><strong>EDGEFORCE</strong><span>INTELLIGENCE OPERATIONS</span></div>
   <div className="efops-side-caption">WORKSPACE</div>
   {(['overview','markets','opportunities','prediction-arbs','agents'] as const).map(tab=><button key={tab} className={view===tab?'efops-tab active':'efops-tab'} onClick={()=>{setView(tab);if(tab==='opportunities'&&token&&snapshot)void loadOpportunities()}}>{tab==='overview'?'▣  Command Center':tab==='markets'?'≡  Sportsbook Coverage':tab==='opportunities'?'◇  Opportunity Review':tab==='prediction-arbs'?'↔  Kalshi / Polymarket':'◈  Agent Monitoring'}</button>)}
   <div className="efops-side-caption">OTHER TOOLS</div>
   <Link className="efops-link" href="/">↗ EdgeForce Dashboard</Link>
   <Link className="efops-link" href="/network">↗ Agent Command Network</Link>
   <Link className="efops-link" href="/network/coverage">↗ Sports Coverage Inspector</Link>
   <div className="efops-foot">Live data only when independently confirmed. Dashboard never calls paid sportsbook providers.</div>
  </aside>
  <main className="efops-main">
   <header className="efops-header"><div><div className="efops-eyebrow">EDGEFORCE / SECURE REMOTE OPERATIONS</div><h1>Sports Intelligence Command Center</h1><p>Source coverage, odds availability and specialist workload — without consuming odds API credits.</p></div><span className="efops-pill">READ-ONLY</span></header>
   <section className="efops-auth"><label htmlFor="efops-token">Operator authentication</label><div><input id="efops-token" autoComplete="off" type="password" value={token} onChange={e=>setToken(e.target.value)} placeholder="Enter your configured operator / cron token"/><button onClick={()=>void refresh()} disabled={loading||!token}>{loading?'Checking…':'Refresh dashboard'}</button><button className="efops-quiet" onClick={()=>{setToken('');setSnapshot(null);setOpportunityData(null);setError('')}}>Lock</button></div><small>Token stays in this page memory only. It is never added to the URL or stored in browser storage.</small>{error&&<p className="efops-error" role="alert">{error}</p>}</section>
   {!snapshot?<div className="efops-empty"><h2>Connect to view your operational data</h2><p>After authentication, EdgeForce reports actual stored odds, DraftKings-labelled availability, registered providers and recorded agent tasks. Missing information remains explicitly unavailable.</p></div>:<>
    <div className="efops-status"><strong>{snapshot.status==='DEGRADED'?'● Data coverage needs attention':snapshot.status==='BLOCKED'?'● Database connection blocked':'● Read-only operational snapshot'}</strong><span>Updated {displayTime(snapshot.generatedAt)} · Build {snapshot.build??'—'}</span></div>
    {view==='overview'&&<><div className="efops-grid">
     <div className="efops-stat"><span>Stored quotes</span><strong>{snapshot.summary?.total.toLocaleString()??'—'}</strong><small>Historical records</small></div>
     <div className="efops-stat"><span>Last 20 minutes</span><strong>{snapshot.summary?.recent.toLocaleString()??'—'}</strong><small>{stale?'No recent stored prices':'Persistence observed'}</small></div>
     <div className="efops-stat"><span>DraftKings-labelled</span><strong>{snapshot.summary?.draftKingsRecent.toLocaleString()??'—'}</strong><small>Last 20 minutes; authenticity not certified</small></div>
     <div className="efops-stat"><span>Provider labels active</span><strong>{snapshot.summary?.independentProvidersRecent??'—'}</strong><small>Not independent-upstream certification</small></div>
    </div><div className="efops-panel"><h2>Launch blockers</h2>{snapshot.blockers?.length?<ul>{snapshot.blockers.map(x=><li key={x}>{x.replaceAll('_',' ')}</li>)}</ul>:<p>No basic storage-count blockers detected. Provider authenticity, full market coverage and independent model calibration are still unverified.</p>}</div><div className="efops-panel"><h2>Configured odds providers</h2><div className="efops-tablebox"><table><thead><tr><th>Provider</th><th>Book label</th><th>Enabled</th><th>Credential</th></tr></thead><tbody>{(snapshot.providers||[]).map(x=><tr key={x.id}><td>{x.name}</td><td>{x.bookmaker}</td><td>{x.enabled?'Yes':'No'}</td><td>{x.credentialConfigured===null?'Not disclosed':x.credentialConfigured?'Configured':'Missing'}</td></tr>)}</tbody></table></div></div></>}
    {view==='markets'&&<div className="efops-panel"><div className="efops-panel-head"><h2>Stored bookmaker coverage — 24 hours</h2><label>Sport <select value={sport} onChange={e=>setSport(e.target.value)}><option value="ALL">All sports</option>{sports.map(x=><option key={x}>{x}</option>)}</select></label></div><div className="efops-tablebox"><table><thead><tr><th>Sport</th><th>Bookmaker</th><th>Provider</th><th>Quotes</th><th>Last stored</th></tr></thead><tbody>{markets.map((x,i)=><tr key={i}><td>{x.sport}</td><td>{x.bookmaker}</td><td>{x.provider}</td><td>{x.quote_count}</td><td>{displayTime(x.most_recent_at)}</td></tr>)}</tbody></table>{!markets.length&&<p>No stored bookmaker observations match this filter.</p>}</div></div>}
    {view==='opportunities'&&<div className="efops-panel"><div className="efops-panel-head"><h2>Archived-odds opportunity review</h2><button className="efops-tab" style={{width:'auto'}} disabled={opportunityLoading} onClick={()=>void loadOpportunities()}>{opportunityLoading?'Reviewing…':'Refresh evidence'}</button></div><p>Only verified, source-dated D1 sportsbook observations are evaluated. These calculations are theoretical and do not certify executable bets or independent model edges.</p>{opportunityError&&<p className="efops-error" role="alert">{opportunityError}</p>}{opportunityData&&<><div className="efops-grid"><div className="efops-stat"><span>Source-validated quotes</span><strong>{opportunityData.verified?.acceptedQuotes??0}</strong><small>Last 20 minutes</small></div><div className="efops-stat"><span>Theoretical opportunities</span><strong>{opportunityData.opportunities?.opportunities.length??0}</strong><small>Not executable confirmation</small></div><div className="efops-stat"><span>Reviewed groups</span><strong>{opportunityData.opportunities?.evaluatedGroups??0}</strong><small>Compatible markets only</small></div><div className="efops-stat"><span>Calibrated +EV picks</span><strong>0</strong><small>Independent models not certified</small></div></div><div className="efops-tablebox"><table><thead><tr><th>Event / market</th><th>Theoretical ROI</th><th>Books and quotes</th><th>Status</th></tr></thead><tbody>{(opportunityData.opportunities?.opportunities||[]).map((o,i)=><tr key={i}><td>{o.eventId} · {o.marketKey}</td><td>{o.theoreticalRoiPct.toFixed(2)}%</td><td>{o.stakes.map(x=>`${x.bookmaker}: ${x.selection} (${x.odds>0?'+':''}${x.odds})`).join(' / ')}</td><td>{o.status.replaceAll('_',' ')}</td></tr>)}</tbody></table>{!opportunityData.opportunities?.opportunities.length&&<p>No source-verified theoretical opportunities available from archived quotes. No prices or model probabilities were invented.</p>}</div></>}</div>}
    {view==='prediction-arbs'&&<PredictionArbitrageStudio operatorToken={token}/>}
    {view==='agents'&&<div className="efops-panel"><h2>Recorded specialist execution — 7 days</h2><div className="efops-tablebox"><table><thead><tr><th>Specialist</th><th>Status</th><th>Executions</th><th>Last scheduled</th></tr></thead><tbody>{(snapshot.agentSummary||[]).map((x,i)=><tr key={i}><td>{x.agent_id}</td><td>{x.status}</td><td>{x.count}</td><td>{displayTime(x.most_recent_at)}</td></tr>)}</tbody></table>{!snapshot.agentSummary?.length&&<p>No recorded specialist tasks in this period. Registered roles are not proof of running agents.</p>}</div></div>}
    <p className="efops-disclosure">Read-only database snapshot · Zero live sportsbook polling from this dashboard · The presence of a stored quote does not certify an executable offer or positive expected value.</p>
   </>}
  </main></div>
}
