'use client';

import {useEffect,useState} from 'react';

type Profile={decision:string;sampleSize:number;meanScore:number;successRate:number;error:number};
type Payload={sampleSize:number;brierScore:number;calibrationError:number;recommendSuccessRate:number;holdSuccessRate:number;rejectSuccessRate:number;profiles:Profile[]};

export default function PreventiveDecisionCalibrationPanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{
  let active=true;
  const load=async()=>{try{const r=await fetch('/api/operations/preventive-decision-calibration',{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{}};
  void load();const t=window.setInterval(()=>void load(),120000);return()=>{active=false;window.clearInterval(t)};
 },[]);
 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div><div className="eyebrow">V81 DECISION CALIBRATION</div><h3>Preventive Gate Accuracy & Reliability</h3></div>
   <div className="panelMeta"><span>{data?.sampleSize||0} samples</span><span>{data?Math.round((1-data.calibrationError)*100)+'% calibrated':'—'}</span></div>
  </div>
  <div className="v21Stats">
   <div><small>BRIER SCORE</small><strong>{data?data.brierScore.toFixed(3):'—'}</strong><span>lower is better</span></div>
   <div><small>CALIBRATION ERROR</small><strong>{data?Math.round(data.calibrationError*100)+'%':'—'}</strong><span>score vs outcome</span></div>
   <div><small>RECOMMEND SUCCESS</small><strong>{data?Math.round(data.recommendSuccessRate*100)+'%':'—'}</strong><span>evaluated decisions</span></div>
   <div><small>HOLD SUCCESS</small><strong>{data?Math.round(data.holdSuccessRate*100)+'%':'—'}</strong><span>evaluated decisions</span></div>
  </div>
  <div className="historyBox"><h4>Decision calibration profiles</h4>
   {(data?.profiles||[]).map(p=><div className="historyRow" key={p.decision}><span>{p.decision}</span><b>{Math.round(p.successRate*100)}%</b><small>{p.sampleSize} samples · error {Math.round(p.error*100)}%</small></div>)}
  </div>
  <div className="historyNote">V81 measures how well V80 decision scores align with later outcomes. It does not change production automatically.</div>
 </section>;
}
