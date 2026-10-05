'use client';
import {useEffect,useState} from 'react';
type Payload={state:string;stage:number;stageStreak:number;adaptiveWeight:number;rationale:string[]};
export default function PreventiveThresholdProbationPanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{let active=true;const load=async()=>{try{const r=await fetch('/api/operations/preventive-threshold-probation',{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{}};void load();const t=window.setInterval(()=>void load(),120000);return()=>{active=false;window.clearInterval(t)}},[]);
 return <section className="v21Panel">
  <div className="v21PanelHead"><div><div className="eyebrow">V85 RE-ENTRY PROBATION</div><h3>Staged Adaptive Threshold Rollout</h3></div><div className="panelMeta"><span>{data?.state||'LOADING'}</span><span>{data?Math.round(data.adaptiveWeight*100)+'% influence':'—'}</span></div></div>
  <div className="v21Stats">
   <div><small>STAGE</small><strong>{data?.stage||0}/4</strong><span>probation rollout</span></div>
   <div><small>ADAPTIVE WEIGHT</small><strong>{data?Math.round(data.adaptiveWeight*100)+'%':'—'}</strong><span>threshold influence</span></div>
   <div><small>STAGE STREAK</small><strong>{data?.stageStreak||0}</strong><span>healthy windows</span></div>
   <div><small>STATE</small><strong>{data?.state||'—'}</strong><span>staged recovery</span></div>
  </div>
  <div className="historyBox"><h4>Probation rationale</h4>{(data?.rationale||[]).map((x,i)=><div className="historyRow" key={i}><span>{x}</span></div>)}</div>
  <div className="historyNote">V85 stages adaptive threshold influence at 25%, 50%, 75%, then 100%, and reverts to zero if evidence regresses.</div>
 </section>;
}
