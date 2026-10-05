'use client';
import {useEffect,useState} from 'react';
type Payload={status:string;issueCount:number;repairedCount:number;consistencyScore:number;repairCodes:string[];rationale:string[]};
export default function PreventiveBaselineConsistencyPanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{let active=true;const load=async()=>{try{const r=await fetch('/api/operations/preventive-baseline-consistency',{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{}};void load();const t=window.setInterval(()=>void load(),120000);return()=>{active=false;window.clearInterval(t)}},[]);
 return <section className="v21Panel">
  <div className="v21PanelHead"><div><div className="eyebrow">V93 LIFECYCLE CONSISTENCY</div><h3>Baseline State Reconciliation</h3></div><div className="panelMeta"><span>{data?.status||'LOADING'}</span><span>{data?Math.round(data.consistencyScore*100)+'% consistent':'—'}</span></div></div>
  <div className="v21Stats">
   <div><small>ISSUES</small><strong>{data?.issueCount||0}</strong><span>remaining inconsistencies</span></div>
   <div><small>REPAIRED</small><strong>{data?.repairedCount||0}</strong><span>safe reconciliations</span></div>
   <div><small>CONSISTENCY</small><strong>{data?Math.round(data.consistencyScore*100)+'%':'—'}</strong><span>lifecycle state</span></div>
   <div><small>LAST REPAIRS</small><strong>{data?.repairCodes?.length||0}</strong><span>bounded metadata fixes</span></div>
  </div>
  <div className="historyBox"><h4>Consistency rationale</h4>{(data?.rationale||[]).map((x,i)=><div className="historyRow" key={i}><span>{x}</span></div>)}</div>
  <div className="historyNote">V93 only performs conservative lifecycle reconciliation. It cannot promote a champion, raise adaptive influence, or execute operational preventive actions.</div>
 </section>;
}
