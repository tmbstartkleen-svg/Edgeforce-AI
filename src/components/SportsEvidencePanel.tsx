'use client';
import {useEffect,useRef,useState} from 'react';
import {createOperationsRequestScope,readOperationsResponse} from '@/lib/operations-request.mjs';
import type {SimulationEvidence,SportsCoverageRow} from '@/lib/intelligence-core/sports-evidence.mjs';
type Quote={sport:string;league:string;event:string;market:string;selection:string;bookmaker:string;odds:number;sourceId:string;upstreamId:string;observedAt:string;payloadHash:string;monteCarlo:SimulationEvidence|null};
type Evidence={ok:boolean;generatedAt:string;coverage:SportsCoverageRow[];rows:Quote[];approvedOddsSources:number;sampleLimited:boolean};
const date=(s:string|null)=>s?new Date(s).toLocaleString():'No observation';
export default function SportsEvidencePanel({token}:{token:string}){
 const [data,setData]=useState<Evidence|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[search,setSearch]=useState('');
 const scope=useRef(createOperationsRequestScope());
 useEffect(()=>{const current=scope.current;return()=>current.reset()},[]);
 async function load(){
  const request=scope.current.begin();setBusy(true);setError('');
  try{const response=await fetch('/api/operations/sports-evidence',{headers:{authorization:'Bearer '+token.trim()},cache:'no-store',signal:request.signal});
   const result=await readOperationsResponse<Evidence>(response);if(request.isCurrent())setData(result);
  }catch(e){if(request.isCurrent()){setData(null);setError(request.signal.aborted?'Request timed out. Try again.':e instanceof Error?e.message:'Evidence unavailable.')}}
  finally{request.finish();if(request.isCurrent())setBusy(false)}
 }
 const query=search.trim().toLowerCase();
 const coverage=(data?.coverage||[]).filter(x=>[x.label,x.family,...x.sources].join(' ').toLowerCase().includes(query));
 const quotes=(data?.rows||[]).filter(x=>[x.sport,x.league,x.event,x.bookmaker,x.selection].join(' ').toLowerCase().includes(query));
 return <section className="efops-panel" aria-label="Sports network evidence">
  <div className="efops-panel-head"><h2>Sports network evidence</h2><button className="efops-action" disabled={busy||!token.trim()} onClick={()=>void load()}>{busy?'Reading stored evidence…':'Load stored coverage'}</button></div>
  <p>Read-only connection to our sports-network archive. Scores, sportsbook prices and simulation results are reported separately. Registered sports are coverage targets, not proof that every event or market is covered.</p>
  {error&&<p role="alert" className="efops-error">{error}</p>}
  {data&&<>
   <p role="status">{data.coverage.length} registered or observed feeds · {data.coverage.filter(x=>x.observations>0).length} with stored scores · {data.approvedOddsSources} enabled odds sources · Checked {date(data.generatedAt)}</p>
   {data.sampleLimited&&<p className="efops-error">Results reached a query limit. This is a bounded sample, not complete coverage.</p>}
   <label className="efops-field">Find sport, league or source<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="NFL, soccer, tennis, source…"/></label>
   <h3>Odds and Monte Carlo estimates</h3>
   <p>Monte Carlo percentages require stored trial counts, a matching quote fingerprint, and recent input records from enabled network sources. The interval measures simulation sampling uncertainty, not model accuracy. Calibration and executable prices remain unverified.</p>
   <div className="efops-tablebox"><table><thead><tr><th>Sport / Event</th><th>Market / Selection</th><th>Book / Odds</th><th>Monte Carlo %</th><th>Source evidence</th></tr></thead><tbody>{quotes.map((x,i)=><tr key={x.payloadHash+i}>
    <td>{x.sport} · {x.league}<br/>{x.event}</td><td>{x.market}<br/>{x.selection}</td><td>{x.bookmaker}<br/>{x.odds>0?'+':''}{x.odds}</td>
    <td>{x.monteCarlo?<><strong>{x.monteCarlo.percent.toFixed(1)}%</strong><br/><small>95% interval {x.monteCarlo.low.toFixed(1)}–{x.monteCarlo.high.toFixed(1)}%<br/>{x.monteCarlo.runs.toLocaleString()} trials · {x.monteCarlo.modelVersion}<br/>{date(x.monteCarlo.createdAt)} · Not calibrated</small></>:<><strong>Unavailable</strong><br/><small>No matching, source-backed trial evidence</small></>}</td>
    <td>{x.sourceId}<br/>{x.upstreamId}<br/>{date(x.observedAt)}</td>
   </tr>)}</tbody></table></div>
   {!quotes.length&&<p>No eligible stored odds match this view. Scores and market-derived estimates are not substituted for sportsbook prices or Monte Carlo results.</p>}
   <h3>All registered sports and league feeds</h3>
   <div className="efops-tablebox"><table><thead><tr><th>Sport / League</th><th>Family</th><th>Score observations</th><th>Latest source time</th><th>Coverage status</th></tr></thead><tbody>{coverage.map(x=><tr key={x.id}><td>{x.label}</td><td>{x.family}</td><td>{x.observations.toLocaleString()}</td><td>{date(x.latest)}</td><td>{x.status.replaceAll('_',' ')}<br/><small>{x.sources.join(', ')||'No stored source evidence'}</small></td></tr>)}</tbody></table></div>
   {!coverage.length&&<p>No registered sports or observed sources match this search.</p>}
  </>}
 </section>;
}
