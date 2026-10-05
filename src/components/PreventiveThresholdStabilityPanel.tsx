'use client';

import {useEffect,useState} from 'react';

type Payload={status:string;driftScore:number;instabilityScore:number;rollbackCount:number;rollbackApplied:boolean;activeSnapshotId:number|null;lastSafeSnapshotId:number|null;rationale:string[]};

export default function PreventiveThresholdStabilityPanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{
  let active=true;
  const load=async()=>{try{const r=await fetch('/api/operations/preventive-threshold-stability',{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{}};
  void load();const t=window.setInterval(()=>void load(),120000);return()=>{active=false;window.clearInterval(t)};
 },[]);
 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div><div className="eyebrow">V83 THRESHOLD STABILITY</div><h3>Adaptive Drift & Safe Rollback Governor</h3></div>
   <div className="panelMeta"><span>{data?.status||'LOADING'}</span><span>{data?Math.round(data.instabilityScore*100)+'% instability':'—'}</span></div>
  </div>
  <div className="v21Stats">
   <div><small>DRIFT</small><strong>{data?Math.round(data.driftScore*100)+'%':'—'}</strong><span>threshold movement</span></div>
   <div><small>ROLLBACKS</small><strong>{data?.rollbackCount||0}</strong><span>safe threshold restores</span></div>
   <div><small>ACTIVE SNAPSHOT</small><strong>{data?.activeSnapshotId||'—'}</strong><span>current adaptive set</span></div>
   <div><small>LAST SAFE</small><strong>{data?.lastSafeSnapshotId||'—'}</strong><span>rollback target</span></div>
  </div>
  <div className="historyBox"><h4>Stability rationale</h4>{(data?.rationale||[]).map((x,i)=><div className="historyRow" key={i}><span>{x}</span></div>)}</div>
  <div className="historyNote">V83 can restore a previously proven threshold set when adaptive drift becomes unstable. It does not execute operational preventive actions.</div>
 </section>;
}
