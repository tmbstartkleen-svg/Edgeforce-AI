'use client';
import {useEffect,useState} from 'react';
type Payload={status:string;promoted:boolean;promotionCount:number;sourceReadinessScore:number;promotedCalibrationError:number;promotedBrierScore:number;promotedSampleSize:number;rationale:string[]};
export default function PreventiveBaselineHandoffPanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{let active=true;const load=async()=>{try{const r=await fetch('/api/operations/preventive-baseline-handoff',{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{}};void load();const t=window.setInterval(()=>void load(),120000);return()=>{active=false;window.clearInterval(t)}},[]);
 return <section className="v21Panel">
  <div className="v21PanelHead"><div><div className="eyebrow">V90 BASELINE HANDOFF</div><h3>Validated Successor Promotion</h3></div><div className="panelMeta"><span>{data?.status||'LOADING'}</span><span>{data?.promoted?'NEW CHAMPION':'NO HANDOFF'}</span></div></div>
  <div className="v21Stats">
   <div><small>READINESS</small><strong>{data?Math.round(data.sourceReadinessScore*100)+'%':'—'}</strong><span>V89 source score</span></div>
   <div><small>CAL ERROR</small><strong>{data?Math.round(data.promotedCalibrationError*100)+'%':'—'}</strong><span>successor reference</span></div>
   <div><small>BRIER</small><strong>{data?data.promotedBrierScore.toFixed(3):'—'}</strong><span>successor reference</span></div>
   <div><small>PROMOTIONS</small><strong>{data?.promotionCount||0}</strong><span>succession handoffs</span></div>
  </div>
  <div className="historyBox"><h4>Handoff rationale</h4>{(data?.rationale||[]).map((x,i)=><div className="historyRow" key={i}><span>{x}</span></div>)}</div>
  <div className="historyNote">V90 promotes only a READY successor that also passes stronger readiness, calibration, Brier, maturity, and no-active-champion checks.</div>
 </section>;
}
