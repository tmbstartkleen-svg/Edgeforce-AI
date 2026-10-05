'use client';
import {useEffect,useState} from 'react';
type Payload={status:string;graduated:boolean;graduationCount:number;validationStreak:number;source:string|null;rationale:string[]};
export default function PreventiveSuccessorGraduationPanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{let active=true;const load=async()=>{try{const r=await fetch('/api/operations/preventive-successor-graduation',{cache:'no-store'});const j=await r.json();if(active&&r.ok)setData(j)}catch{}};void load();const t=window.setInterval(()=>void load(),120000);return()=>{active=false;window.clearInterval(t)}},[]);
 return <section className="v21Panel">
  <div className="v21PanelHead"><div><div className="eyebrow">V92 SUCCESSOR GRADUATION</div><h3>Champion Lifecycle Closure</h3></div><div className="panelMeta"><span>{data?.status||'LOADING'}</span><span>{data?.graduated?'GRADUATED':'PENDING'}</span></div></div>
  <div className="v21Stats">
   <div><small>VALIDATION</small><strong>{data?.validationStreak||0}/3</strong><span>post-handoff windows</span></div>
   <div><small>GRADUATIONS</small><strong>{data?.graduationCount||0}</strong><span>confirmed successors</span></div>
   <div><small>SOURCE</small><strong>{data?.source||'—'}</strong><span>pre-graduation state</span></div>
   <div><small>LIFECYCLE</small><strong>{data?.graduated?'NORMAL':'PROBATIONARY'}</strong><span>champion supervision</span></div>
  </div>
  <div className="historyBox"><h4>Graduation rationale</h4>{(data?.rationale||[]).map((x,i)=><div className="historyRow" key={i}><span>{x}</span></div>)}</div>
  <div className="historyNote">V92 graduates only V91-confirmed succession champions; afterward V88 normal champion-health supervision remains authoritative.</div>
 </section>;
}
