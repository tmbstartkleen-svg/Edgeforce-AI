'use client';
import {useState} from 'react';

type ModelMetrics={sport:string;modelVersion:string;sampleSize:number;accuracy:number;brierScore:number;
 logLoss:number;calibrationError:number;quality:string;outOfSampleProven:false};
type BacktestResponse={ok:boolean;status?:string;reviewed?:number;graded?:number;
 rejected?:Record<string,number>;results?:ModelMetrics[];warning?:string;
 consideredSourceProviders?:Array<{sourceId:string;upstreamOwner:string;independentSourceEnabled:boolean;retentionReviewed:boolean}>};
type IdentityRecord={id:string;entityType:string;canonicalId:string;source:string;sourceEntityId:string;reviewStatus:string};
type IdentityResponse={ok:boolean;status?:string;mappings?:IdentityRecord[];reasons?:string[]};
const pct=(v:number)=>Number.isFinite(v)?(v*100).toFixed(1)+'%':'Unknown';
const decimal=(v:number)=>Number.isFinite(v)?v.toFixed(3):'Unknown';
export default function SportsIdentityAccuracy({token,sport}:{token:string;sport:string}){
 const [report,setReport]=useState<BacktestResponse|null>(null);
 const [identity,setIdentity]=useState<IdentityResponse|null>(null);
 const [kind,setKind]=useState<'EVENT'|'TEAM'|'ATHLETE'>('EVENT');
 const [canonical,setCanonical]=useState(''),[source,setSource]=useState(''),[sourceId,setSourceId]=useState('');
 const [sourceLabel,setSourceLabel]=useState('');
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const headers={Authorization:'Bearer '+token};
 const request=async (action:'backtests'|'identity')=>{
  if(busy)return;setBusy(true);setMessage('');
  try{
   const path=action==='backtests'?'/api/network/v1/backtests?'+new URLSearchParams(sport==='ALL'?{}:{sport}):
    '/api/network/v1/identity?'+new URLSearchParams({type:kind});
   const res=await fetch(path,{cache:'no-store',headers});
   const data=await res.json() as BacktestResponse&IdentityResponse;
   if(!res.ok)throw Error(data.status||'Network research unavailable');
   if(action==='backtests')setReport(data);
   else setIdentity(data);
  }catch(e){setMessage(e instanceof Error?e.message:'Request failed')}
  finally{setBusy(false)}
 };
 const link=async()=>{
  if(busy)return;setBusy(true);setMessage('');
  try{
   const res=await fetch('/api/network/v1/identity',{
    method:'POST',cache:'no-store',headers:{...headers,'Content-Type':'application/json'},
    body:JSON.stringify({type:kind,canonicalId:canonical,source,sourceEntityId:sourceId,
     ...(kind==='EVENT'?{}:{sourceLabel})})
   });
   const data=await res.json() as IdentityResponse;
   if(!res.ok)throw Error(data.status+(data.reasons?.length?' · '+data.reasons.join('; '):''));
   setMessage('Exact-match identity link recorded. This does not certify a final score.');
   setIdentity(null);
  }catch(e){setMessage(e instanceof Error?e.message:'Identity mapping rejected')}
  finally{setBusy(false)}
 };
 return <section className="efAccuracy" aria-label="Sports Network identity and backtesting">
  <header className="efWarehouseHead"><div>
   <span className="efKicker">EDGEFORCE SPORTS NETWORK / V210 / MODEL ACCOUNTABILITY</span>
   <h3>Identity & prediction accuracy</h3>
   <p>Match source-defined games to canonical events, then score saved pregame probabilities only against outcomes agreed by reviewed, independently owned sources.</p>
  </div><span className="efWarehouseTag">AUDITABLE · NO MADE-UP EDGE</span></header>
  <div className="efAccuracyActions">
   <button disabled={busy||token.length!==64} type="button" onClick={()=>void request('backtests')}>Evaluate stored predictions</button>
   <button disabled={busy||token.length!==64} type="button" onClick={()=>void request('identity')}>Inspect identity mappings</button>
  </div>
  {report&&<div className="efAccuracyReport">
   <div className="efCoverageMetrics">
    <div><small>Models reviewed</small><strong>{report.reviewed??0}</strong></div>
    <div><small>Cross-source graded</small><strong>{report.graded??0}</strong></div>
    <div><small>Not scoreable</small><strong>{(report.reviewed??0)-(report.graded??0)}</strong></div>
    <div><small>Eligible upstream registrations</small><strong>{(report.consideredSourceProviders||[]).filter(p=>p.independentSourceEnabled&&p.retentionReviewed).length}</strong></div>
   </div>
   <p className="efChronicleNotice">{report.warning}</p>
   <div className="efAccuracyRows">
    {(report.results||[]).map(r=><article key={r.sport+'|'+r.modelVersion}>
     <div><b>{r.sport} · {r.modelVersion}</b><small>{r.sampleSize} uniquely matched games · {r.quality.replaceAll('_',' ')}</small></div>
     <div><span>Directional accuracy</span><strong>{pct(r.accuracy)}</strong></div>
     <div><span>Brier score ↓</span><strong>{decimal(r.brierScore)}</strong></div>
     <div><span>Calibration error ↓</span><strong>{pct(r.calibrationError)}</strong></div>
     <div><span>Log loss ↓</span><strong>{decimal(r.logLoss)}</strong></div>
    </article>)}
   </div>
   {!report.results?.length&&<p className="efWarehouseNotice">No models have sufficient independently reviewed final-score evidence for grading. This is a verified data gap—not a 0% win rate.</p>}
   <details className="efAccuracyRejected"><summary>Why forecasts were excluded</summary>
    {Object.entries(report.rejected||{}).map(([reason,n])=><p key={reason}>{reason.replaceAll('_',' ')}: {n}</p>)}
    <p>Only settled two-sided pregame team moneylines are eligible. Player props, draws, spreads, totals, post-game models and unverified scores are excluded.</p>
   </details>
  </div>}
  {identity&&<div className="efAccuracyIdentity">
   <h4>Reviewed {kind.toLowerCase()} source identities</h4>
   {(identity.mappings||[]).map(r=><div key={r.id}><strong>{r.canonicalId}</strong><span>{r.source} / {r.sourceEntityId}</span><small>{r.reviewStatus.replaceAll('_',' ')}</small></div>)}
   {!identity.mappings?.length&&<p>No reviewed source identities recorded for this class.</p>}
  </div>}
  <div className="efAccuracyReview">
   <h4>Operator identity review</h4>
   <p>Manually bind a source game to an existing canonical event only when sport, league, home/away names and kickoff agree. Team/player aliases require exact declared names and do not constitute external identity verification. Disabled unless the operator explicitly enables review.</p>
   <div>
    <label>Record type<select value={kind} onChange={e=>{setKind(e.target.value as 'EVENT'|'TEAM'|'ATHLETE');setIdentity(null)}}><option>EVENT</option><option>TEAM</option><option>ATHLETE</option></select></label>
    <label>Canonical record ID<input value={canonical} maxLength={110} onChange={e=>setCanonical(e.target.value)} placeholder="Canonical EdgeForce ID"/></label>
    <label>Source<input value={source} maxLength={64} onChange={e=>setSource(e.target.value)} placeholder="Verified provider ID"/></label>
    <label>Source record ID<input value={sourceId} maxLength={110} onChange={e=>setSourceId(e.target.value)} placeholder="Provider-specific identifier"/></label>
    {kind!=='EVENT'&&<label>Source display name<input value={sourceLabel} maxLength={160} onChange={e=>setSourceLabel(e.target.value)} placeholder="Exact athlete / team name"/></label>}
   </div>
   <button type="button" disabled={busy||token.length!==64||!canonical||!source||!sourceId||kind!=='EVENT'&&!sourceLabel} onClick={()=>void link()}>Review & link source record</button>
  </div>
  {message&&<p role="status" className="efChronicleAlert">{message}</p>}
  <p className="efWarehouseFooter">Measured historical calibration is not guaranteed future accuracy. Out-of-sample validation, model leakage audits, real sportsbook quotes, and exact market settlement definitions remain separate requirements.</p>
 </section>;
}
