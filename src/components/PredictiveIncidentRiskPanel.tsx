'use client';

import {useEffect,useState} from 'react';

type Risk={cause:string;riskScore:number;riskLevel:string;evidence:string[];preventiveActions:string[]};
type Payload={predictedCause:string;riskScore:number;riskLevel:string;horizonHours:number;preventiveWarning:boolean;componentRisks:Risk[];preventiveActions:string[];evidence:string[]};

export default function PredictiveIncidentRiskPanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{
  let active=true;
  const load=async()=>{try{const r=await fetch('/api/operations/predictive-incident-risk',{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{}};
  void load();const t=window.setInterval(()=>void load(),120000);return()=>{active=false;window.clearInterval(t)};
 },[]);
 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div><div className="eyebrow">V77 PREDICTIVE INCIDENT RISK</div><h3>Next-Failure Forecast & Preventive Warning Layer</h3></div>
   <div className="panelMeta"><span>{data?.riskLevel||'LOADING'}</span><span>{data?Math.round(data.riskScore*100)+'% risk':'—'}</span></div>
  </div>
  <div className="v21Stats">
   <div><small>PREDICTED CAUSE</small><strong>{data?.predictedCause||'—'}</strong><span>{data?.horizonHours||24}h horizon</span></div>
   <div><small>PREVENTIVE WARNING</small><strong>{data?.preventiveWarning?'ON':'OFF'}</strong><span>threshold ≥70%</span></div>
   <div><small>COMPONENT RISKS</small><strong>{data?.componentRisks.length||0}</strong><span>ranked subsystems</span></div>
   <div><small>TOP RISK</small><strong>{data?Math.round(data.riskScore*100)+'%':'—'}</strong><span>{data?.riskLevel||'—'}</span></div>
  </div>
  <div className="historyGrid">
   <div className="historyBox"><h4>Predictive evidence</h4>{(data?.evidence||[]).map((x,i)=><div className="historyRow" key={i}><span>{x}</span></div>)}</div>
   <div className="historyBox"><h4>Preventive actions</h4>{(data?.preventiveActions||[]).map((x,i)=><div className="historyRow" key={i}><span>{x}</span></div>)}</div>
  </div>
  <div className="historyNote">V77 forecasts operational risk from recurring incident history plus current health pressure. It is preventive guidance only and does not bypass deployment, SLO, or betting safeguards.</div>
 </section>;
}
