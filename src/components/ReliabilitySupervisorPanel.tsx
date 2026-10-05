'use client';

import {useEffect,useState} from 'react';

type Row={componentId:string;label:string;required:boolean;circuitState:string;observedState:string;consecutiveFailures:number;consecutiveHealthy:number;reliabilityScore:number;lastReason?:string|null;updatedAt:string};
type Summary={mode:string;score:number;criticalOpen:boolean;openComponents:string[];halfOpenComponents:string[];rows:Row[];latestRun?:{openedThisRun:number;recoveredThisRun:number}|null};
const pct=(n:number)=>Math.round(n*1000)/10+'%';

export default function ReliabilitySupervisorPanel(){
 const [data,setData]=useState<Summary|null>(null);
 useEffect(()=>{let on=true;const load=()=>fetch('/api/intelligence/reliability',{cache:'no-store'}).then(r=>r.json()).then(x=>{if(on)setData(x)}).catch(()=>{});void load();const t=window.setInterval(load,60000);return()=>{on=false;window.clearInterval(t)}},[]);
 return <section className="v21Card">
  <div className="v21CardHead"><div><div className="eyebrow">V72 RELIABILITY SUPERVISOR</div><h3>Drift isolation & automatic recovery</h3></div><span>{data?.mode||'WAITING'}</span></div>
  <div className="statRow"><div><small>RELIABILITY</small><strong>{data?pct(data.score):'—'}</strong></div><div><small>OPEN CIRCUITS</small><strong>{data?.openComponents.length??0}</strong></div><div><small>HALF OPEN</small><strong>{data?.halfOpenComponents.length??0}</strong></div><div><small>RECOVERED</small><strong>{data?.latestRun?.recoveredThisRun??0}</strong></div></div>
  <p className="muted">Repeated hard failures isolate optional intelligence layers. Required failures force protective mode. Recovery needs two healthy checks before the circuit closes.</p>
  <div className="tableWrap"><table><thead><tr><th>Component</th><th>Circuit</th><th>Observed</th><th>Failures</th><th>Healthy</th><th>Score</th><th>Required</th></tr></thead>
   <tbody>{(data?.rows||[]).map(x=><tr key={x.componentId}><td><b>{x.label}</b></td><td>{x.circuitState}</td><td>{x.observedState}</td><td>{x.consecutiveFailures}</td><td>{x.consecutiveHealthy}</td><td>{pct(x.reliabilityScore)}</td><td>{x.required?'YES':'NO'}</td></tr>)}{!data?.rows?.length&&<tr><td colSpan={7} className="emptyRow">Reliability state populates after the supervisor completes its first run.</td></tr>}</tbody>
  </table></div>
 </section>;
}
