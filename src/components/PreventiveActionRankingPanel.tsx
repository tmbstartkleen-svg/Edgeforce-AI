'use client';

import {useEffect,useState} from 'react';

type Recommendation={actionKey:string;actionText:string;priorityScore:number;effectivenessScore:number;confidence:number;evidenceQuality:string;reason:string[]};
type Payload={predictedCause:string;sourceRiskScore:number;sourceRiskLevel:string;topRecommendation:Recommendation|null;recommendations:Recommendation[]};

export default function PreventiveActionRankingPanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{
  let active=true;
  const load=async()=>{try{const r=await fetch('/api/operations/preventive-action-ranking',{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{}};
  void load();const t=window.setInterval(()=>void load(),120000);return()=>{active=false;window.clearInterval(t)};
 },[]);
 const top=data?.topRecommendation;
 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div><div className="eyebrow">V79 PREVENTIVE ACTION PRIORITY</div><h3>Risk-Aware Safeguard Ranking</h3></div>
   <div className="panelMeta"><span>{data?.sourceRiskLevel||'LOADING'}</span><span>{top?Math.round(top.priorityScore*100)+'% priority':'—'}</span></div>
  </div>
  <div className="v21Stats">
   <div><small>PREDICTED CAUSE</small><strong>{data?.predictedCause||'—'}</strong><span>{data?Math.round(data.sourceRiskScore*100)+'% current risk':'—'}</span></div>
   <div><small>TOP EVIDENCE</small><strong>{top?.evidenceQuality||'—'}</strong><span>effectiveness maturity</span></div>
   <div><small>EFFECTIVENESS</small><strong>{top?Math.round(top.effectivenessScore*100)+'%':'—'}</strong><span>learned outcome score</span></div>
   <div><small>CONFIDENCE</small><strong>{top?Math.round(top.confidence*100)+'%':'—'}</strong><span>historical support</span></div>
  </div>
  <div className="historyGrid">
   <div className="historyBox"><h4>Ranked safeguards</h4>
    {(data?.recommendations||[]).slice(0,6).map((x,i)=><div className="historyRow" key={x.actionKey}><span>{i+1}. {x.actionText}</span><b>{Math.round(x.priorityScore*100)}%</b><small>{x.evidenceQuality} evidence</small></div>)}
   </div>
   <div className="historyBox"><h4>Top recommendation evidence</h4>
    {(top?.reason||[]).map((x,i)=><div className="historyRow" key={i}><span>{x}</span></div>)}
   </div>
  </div>
  <div className="historyNote">V79 prioritizes safeguards from current risk plus learned effectiveness. It remains advisory and requires operator confirmation before any production change.</div>
 </section>;
}
