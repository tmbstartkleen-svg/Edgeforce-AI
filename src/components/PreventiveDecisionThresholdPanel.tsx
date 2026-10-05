'use client';

import {useEffect,useState} from 'react';

type Payload={recommendThreshold:number;confidenceFloor:number;riskFloor:number;rejectEffectivenessCeiling:number;sourceSampleSize:number;sourceBrierScore:number;sourceCalibrationError:number;mode:string;rationale:string[]};

export default function PreventiveDecisionThresholdPanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{
  let active=true;
  const load=async()=>{try{const r=await fetch('/api/operations/preventive-decision-thresholds',{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{}};
  void load();const t=window.setInterval(()=>void load(),120000);return()=>{active=false;window.clearInterval(t)};
 },[]);
 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div><div className="eyebrow">V82 ADAPTIVE DECISION THRESHOLDS</div><h3>Calibration-Governed Safety Bounds</h3></div>
   <div className="panelMeta"><span>{data?.mode||'LOADING'}</span><span>{data?.sourceSampleSize||0} calibration samples</span></div>
  </div>
  <div className="v21Stats">
   <div><small>RECOMMEND</small><strong>{data?Math.round(data.recommendThreshold*100)+'%':'—'}</strong><span>gate-score floor</span></div>
   <div><small>CONFIDENCE</small><strong>{data?Math.round(data.confidenceFloor*100)+'%':'—'}</strong><span>evidence floor</span></div>
   <div><small>RISK</small><strong>{data?Math.round(data.riskFloor*100)+'%':'—'}</strong><span>predicted-risk floor</span></div>
   <div><small>REJECT CEILING</small><strong>{data?Math.round(data.rejectEffectivenessCeiling*100)+'%':'—'}</strong><span>effectiveness cutoff</span></div>
  </div>
  <div className="historyBox"><h4>Governor rationale</h4>{(data?.rationale||[]).map((x,i)=><div className="historyRow" key={i}><span>{x}</span></div>)}</div>
  <div className="historyNote">V82 can only tune within fixed safety bounds. It cannot disable the gate or execute preventive actions.</div>
 </section>;
}
