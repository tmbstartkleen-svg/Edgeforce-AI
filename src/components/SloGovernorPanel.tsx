'use client';

import {useEffect,useState} from 'react';

type WindowRow={label:string;samples:number;sufficient:boolean;availability:number;burnRate:number;budgetRemaining:number;criticalSamples:number;actionSamples:number};
type Payload={state:string;deploymentAllowed:boolean;target:number;recoveryStreak:number;current:{overall:string;score:number};windows:{oneHour:WindowRow;twentyFourHour:WindowRow;sevenDay:WindowRow};reasons:string[];warnings:string[]};
const pct=(n:number)=>`${(n*100).toFixed(1)}%`;
const burn=(n:number)=>`${n.toFixed(1)}x`;

export default function SloGovernorPanel(){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{let on=true;const load=()=>fetch('/api/release/error-budget',{cache:'no-store'}).then(r=>r.json()).then(x=>{if(on)setData(x)}).catch(()=>{});void load();const t=window.setInterval(load,60000);return()=>{on=false;window.clearInterval(t)}},[]);
 const windows=data?[data.windows.oneHour,data.windows.twentyFourHour,data.windows.sevenDay]:[];
 return <section className="v21Card">
  <div className="v21CardHead"><div><div className="eyebrow">V74 SLO GOVERNOR</div><h3>Error budget & deployment freeze</h3></div><span>{data?.state||'WAITING'}</span></div>
  <div className="statRow"><div><small>DEPLOYMENT</small><strong>{data?.deploymentAllowed?'OPEN':'FROZEN'}</strong></div><div><small>SLO TARGET</small><strong>{data?pct(data.target):'—'}</strong></div><div><small>CURRENT HEALTH</small><strong>{data?.current.overall||'—'}</strong></div><div><small>RECOVERY</small><strong>{data?.recoveryStreak??0}/3</strong></div></div>
  <p className="muted">Production promotions freeze when reliability burns too quickly. Reopening requires three consecutive safe recovery checks.</p>
  <div className="tableWrap"><table><thead><tr><th>Window</th><th>Samples</th><th>Availability</th><th>Burn</th><th>Budget remaining</th><th>Critical</th><th>ACTION</th></tr></thead>
   <tbody>{windows.map(x=><tr key={x.label}><td><b>{x.label}</b></td><td>{x.samples}{x.sufficient?'':'*'}</td><td>{pct(x.availability)}</td><td>{burn(x.burnRate)}</td><td>{pct(Math.max(0,x.budgetRemaining))}</td><td>{x.criticalSamples}</td><td>{x.actionSamples}</td></tr>)}{!windows.length&&<tr><td colSpan={7} className="emptyRow">SLO windows are waiting for operational health history.</td></tr>}</tbody>
  </table></div>
 </section>;
}
