'use client';

import {useEffect,useState} from 'react';

type Row={id:number;launchId?:string|null;candidateVersion:string;baselineVersion?:string|null;decision:string;hardBlock:boolean;scoreDelta:number;reliabilityDelta:number;criticalCheckDelta:number;blockers:string[];warnings:string[];createdAt:string};
type Payload={snapshot?:{observabilityScore:number;reliabilityScore:number;observabilityOverall:string;reliabilityMode:string};latest?:Row|null;recent?:Row[]};
const pct=(n:number)=>Math.round(n*1000)/10+'%';
const delta=(n:number)=>`${n>=0?'+':''}${(n*100).toFixed(1)} pts`;

export default function DeploymentGuardPanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{let on=true;const load=()=>fetch('/api/release/deployment-guard',{cache:'no-store'}).then(r=>r.json()).then(x=>{if(on)setData(x)}).catch(()=>{});void load();const t=window.setInterval(load,60000);return()=>{on=false;window.clearInterval(t)}},[]);
 const latest=data?.latest;
 return <section className="v21Card">
  <div className="v21CardHead"><div><div className="eyebrow">V73 DEPLOYMENT GUARD</div><h3>Comparative canary & rollback gate</h3></div><span>{latest?.decision||'READY'}</span></div>
  <div className="statRow"><div><small>OBS HEALTH</small><strong>{data?.snapshot?pct(data.snapshot.observabilityScore):'—'}</strong></div><div><small>RELIABILITY</small><strong>{data?.snapshot?pct(data.snapshot.reliabilityScore):'—'}</strong></div><div><small>LAST SCORE Δ</small><strong>{latest?delta(latest.scoreDelta):'—'}</strong></div><div><small>LAST RELIABILITY Δ</small><strong>{latest?delta(latest.reliabilityDelta):'—'}</strong></div></div>
  <p className="muted">New production releases are compared with the production they replaced. Hard failures abort immediately; softer regressions must repeatedly fail the canary gate before rollback.</p>
  <div className="tableWrap"><table><thead><tr><th>Candidate</th><th>Baseline</th><th>Decision</th><th>Hard</th><th>Obs Δ</th><th>Reliability Δ</th><th>Critical Δ</th></tr></thead>
   <tbody>{(data?.recent||[]).slice(0,12).map(x=><tr key={x.id}><td><b>{x.candidateVersion}</b></td><td>{x.baselineVersion||'—'}</td><td>{x.decision}</td><td>{x.hardBlock?'YES':'NO'}</td><td>{delta(x.scoreDelta)}</td><td>{delta(x.reliabilityDelta)}</td><td>{x.criticalCheckDelta}</td></tr>)}{!data?.recent?.length&&<tr><td colSpan={7} className="emptyRow">No comparative production canary has run yet.</td></tr>}</tbody>
  </table></div>
 </section>;
}
