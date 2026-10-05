'use client';
import {useEffect,useState} from 'react';
type Component={id:string;label:string;state:string;required:boolean;rows:number;ageMinutes:number|null;detail:string};
type Report={state:'HEALTHY'|'DEGRADED'|'BLOCKED';score:number;criticalCoverage:number;blockers:string[];warnings:string[];components:Component[];release:{build:string;version:string;modelVersion:string;migrationVersion:number}};
type Payload={current:Report;latest?:{state:string;score:number;observedAt:string}|null};
const pct=(n:number)=>Math.round(n*1000)/10+'%';
export default function UnifiedIntelligencePanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{let on=true;const load=()=>fetch('/api/intelligence/unified-stack',{cache:'no-store'}).then(r=>r.json()).then(x=>{if(on)setData(x)}).catch(()=>{});void load();const t=window.setInterval(load,60000);return()=>{on=false;window.clearInterval(t)}},[]);
 const r=data?.current;
 return <section className="v21Card">
  <div className="v21CardHead"><div><div className="eyebrow">V71 UNIFIED INTELLIGENCE</div><h3>Production intelligence certification</h3></div><span>{r?.state||'WAITING'}</span></div>
  <div className="statRow"><div><small>STACK SCORE</small><strong>{r?pct(r.score):'—'}</strong></div><div><small>CRITICAL COVERAGE</small><strong>{r?pct(r.criticalCoverage):'—'}</strong></div><div><small>BLOCKERS</small><strong>{r?.blockers.length??0}</strong></div><div><small>RELEASE</small><strong>{r?.release.build||'V71'}</strong></div></div>
  <p className="muted">Fail-soft market scoring plus system-level checks across injury, player learning, matchup, lineup, schedule, venue, movement, optimizer, validation and automation.</p>
  <div className="tableWrap"><table><thead><tr><th>Component</th><th>State</th><th>Rows</th><th>Age</th><th>Required</th><th>Detail</th></tr></thead>
   <tbody>{(r?.components||[]).map(x=><tr key={x.id}><td><b>{x.label}</b></td><td>{x.state}</td><td>{x.rows}</td><td>{x.ageMinutes===null?'—':Math.round(x.ageMinutes)+'m'}</td><td>{x.required?'YES':'NO'}</td><td><small>{x.detail}</small></td></tr>)}{!r?.components?.length&&<tr><td colSpan={6} className="emptyRow">Unified certification is waiting for durable intelligence data.</td></tr>}</tbody>
  </table></div>
 </section>;
}
