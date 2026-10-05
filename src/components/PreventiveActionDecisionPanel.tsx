'use client';

import {useEffect,useState} from 'react';

type Payload={decision:string;gateScore:number;predictedCause:string;sourceRiskScore:number;sourceRiskLevel:string;reasons:string[];topAction:{actionText:string;effectivenessScore:number;confidence:number}|null};

export default function PreventiveActionDecisionPanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{
  let active=true;
  const load=async()=>{try{const r=await fetch('/api/operations/preventive-action-decision',{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{}};
  void load();const t=window.setInterval(()=>void load(),120000);return()=>{active=false;window.clearInterval(t)};
 },[]);
 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div><div className="eyebrow">V80 PREVENTIVE ACTION DECISION GATE</div><h3>Recommend, Hold, or Reject</h3></div>
   <div className="panelMeta"><span>{data?.decision||'LOADING'}</span><span>{data?Math.round(data.gateScore*100)+'% gate':'—'}</span></div>
  </div>
  <div className="v21Stats">
   <div><small>PREDICTED CAUSE</small><strong>{data?.predictedCause||'—'}</strong><span>{data?Math.round(data.sourceRiskScore*100)+'% risk':'—'}</span></div>
   <div><small>DECISION</small><strong>{data?.decision||'—'}</strong><span>advisory only</span></div>
   <div><small>EFFECTIVENESS</small><strong>{data?.topAction?Math.round(data.topAction.effectivenessScore*100)+'%':'—'}</strong><span>learned safeguard score</span></div>
   <div><small>CONFIDENCE</small><strong>{data?.topAction?Math.round(data.topAction.confidence*100)+'%':'—'}</strong><span>evidence support</span></div>
  </div>
  <div className="historyGrid">
   <div className="historyBox"><h4>Selected safeguard</h4><div className="historyRow"><span>{data?.topAction?.actionText||'No action selected'}</span></div></div>
   <div className="historyBox"><h4>Gate evidence</h4>{(data?.reasons||[]).map((x,i)=><div className="historyRow" key={i}><span>{x}</span></div>)}</div>
  </div>
  <div className="historyNote">V80 can recommend, hold, or reject a safeguard based on evidence. It never applies the action automatically.</div>
 </section>;
}
