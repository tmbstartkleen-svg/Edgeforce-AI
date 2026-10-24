'use client';
import {useState} from 'react';
type Audit={ok:boolean;error?:string;status?:string;generatedAt?:string;launchCertified?:boolean;blockers?:string[];db?:{existingTables:string[];missingTables:string[]};flags?:Record<string,boolean>;counts?:Record<string,number>};
export default function PredictionLaunchReadiness({operatorToken}:{operatorToken:string}){
 const [data,setData]=useState<Audit|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function verify(){
  if(!operatorToken)return;setBusy(true);setError('');
  try{const r=await fetch('/api/operations/prediction-launch-audit',{headers:{authorization:'Bearer '+operatorToken},cache:'no-store'});
   const body:Audit=await r.json();if(!r.ok||!body.ok){setData(null);setError(body.error||'Production readiness unavailable')}else setData(body)}
  catch{setData(null);setError('Unable to retrieve production certification data')}finally{setBusy(false)}
 }
 return <section className="efops-panel">
  <div className="efops-panel-head"><h2>Prediction market launch audit</h2><button className="efops-action" onClick={()=>void verify()} disabled={!operatorToken||busy}>{busy?'Checking…':'Verify production evidence'}</button></div>
  <p>Reads actual Cloudflare D1 schema, source counts and feature flags. A code merge, a quoted arbitrage gap or a completed build is <b>not</b> live-trading certification.</p>
  {error&&<p className="efops-error" role="alert">{error}</p>}
  {data&&<>
   <p className="efops-error">Launch status: <b>{data.launchCertified?'Certified':'Not certified'}</b> · Evidence checked {data.generatedAt?new Date(data.generatedAt).toLocaleString():'Unknown'}</p>
   <div className="efops-grid">
    {(Object.entries(data.counts||{})).map(([name,count])=><div className="efops-stat" key={name}><span>{name.replace(/([A-Z])/g,' $1')}</span><strong>{count.toLocaleString()}</strong></div>)}
   </div>
   <h3>Launch blockers</h3><ul>{(data.blockers||[]).map(s=><li key={s}>{s.replaceAll('_',' ')}</li>)}</ul>
   <h3>Database readiness</h3><p>{data.db?.missingTables?.length?'Missing: '+data.db.missingTables.join(', '):'Required D1 table names present. Full data readiness is not implied.'}</p>
   <h3>Feature flags</h3><div className="efops-tablebox"><table><thead><tr><th>Subsystem</th><th>Configured</th></tr></thead><tbody>{Object.entries(data.flags||{}).map(([k,v])=><tr key={k}><td>{k}</td><td>{v?'Enabled':'Disabled'}</td></tr>)}</tbody></table></div>
  </>}
 </section>;
}
