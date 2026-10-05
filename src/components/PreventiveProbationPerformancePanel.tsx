'use client';
import {useEffect,useState} from 'react';
type Payload={status:string;degradationScore:number;rollbackCount:number;stageRollbackApplied:boolean;rationale:string[]};
export default function PreventiveProbationPerformancePanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{let active=true;const load=async()=>{try{const r=await fetch('/api/operations/preventive-probation-performance',{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{}};void load();const t=window.setInterval(()=>void load(),120000);return()=>{active=false;window.clearInterval(t)}},[]);
 return <section className="v21Panel">
  <div className="v21PanelHead"><div><div className="eyebrow">V86 PROBATION PERFORMANCE</div><h3>Baseline Comparison & Stage Rollback</h3></div><div className="panelMeta"><span>{data?.status||'LOADING'}</span><span>{data?Math.round(data.degradationScore*100)+'% degradation':'—'}</span></div></div>
  <div className="v21Stats">
   <div><small>STATUS</small><strong>{data?.status||'—'}</strong><span>stage health</span></div>
   <div><small>DEGRADATION</small><strong>{data?Math.round(data.degradationScore*100)+'%':'—'}</strong><span>vs re-entry baseline</span></div>
   <div><small>ROLLBACKS</small><strong>{data?.rollbackCount||0}</strong><span>probation stage rollbacks</span></div>
   <div><small>LAST ACTION</small><strong>{data?.stageRollbackApplied?'ROLLED BACK':'NONE'}</strong><span>automatic stage protection</span></div>
  </div>
  <div className="historyBox"><h4>Performance rationale</h4>{(data?.rationale||[]).map((x,i)=><div className="historyRow" key={i}><span>{x}</span></div>)}</div>
  <div className="historyNote">V86 compares probation performance to the recovery baseline and can roll back one stage when calibration degrades materially.</div>
 </section>;
}
