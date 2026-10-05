'use client';

import {useEffect,useState} from 'react';
type Summary={
 configured:boolean;snapshots24h:number;profiles:number;highLoadEvents24h:number;
 recent:Array<{sport:string;eventName:string;startTime:string;home:string;away:string;homeRestDays:number;awayRestDays:number;homeTravelMiles:number;awayTravelMiles:number;homeFatigue:number;awayFatigue:number;compositeEdge:number;confidence:number}>
};
const d=(n:number)=>Number.isFinite(n)?n.toFixed(1):'-';
const pct=(n:number)=>Math.round(n*1000)/10+'%';
export default function ScheduleFatiguePanel(){
 const [data,setData]=useState<Summary|null>(null);
 useEffect(()=>{let on=true;fetch('/api/intelligence/schedule-fatigue',{cache:'no-store'}).then(r=>r.json()).then(x=>{if(on)setData(x)}).catch(()=>{});return()=>{on=false}},[]);
 return <section className="v21Card">
  <div className="v21CardHead"><div><div className="eyebrow">V67 SCHEDULE INTELLIGENCE</div><h3>Rest, travel & fatigue engine</h3></div><span>{data?.configured?'ACTIVE':'WAITING'}</span></div>
  <div className="statRow"><div><small>24H SNAPSHOTS</small><strong>{data?.snapshots24h??0}</strong></div><div><small>SPORT PROFILES</small><strong>{data?.profiles??0}</strong></div><div><small>HIGH LOAD</small><strong>{data?.highLoadEvents24h??0}</strong></div></div>
  <p className="muted">Measures back-to-backs, 3-in-4 and 4-in-6 stretches, road-trip length, previous-venue travel, timezone changes and recovery time before simulation.</p>
  <div className="tableWrap"><table><thead><tr><th>Event</th><th>Rest H/A</th><th>Travel H/A</th><th>Fatigue H/A</th><th>Edge</th><th>Confidence</th></tr></thead>
   <tbody>{(data?.recent||[]).slice(0,12).map(x=><tr key={x.sport+x.eventName+x.startTime}><td><b>{x.eventName}</b><br/><small>{x.sport}</small></td><td>{d(x.homeRestDays)} / {d(x.awayRestDays)}d</td><td>{Math.round(x.homeTravelMiles)} / {Math.round(x.awayTravelMiles)} mi</td><td>{pct(x.homeFatigue)} / {pct(x.awayFatigue)}</td><td>{x.compositeEdge>=0?'+':''}{x.compositeEdge.toFixed(2)}</td><td>{pct(x.confidence)}</td></tr>)}{!data?.recent?.length&&<tr><td colSpan={6} className="emptyRow">Schedule fatigue snapshots populate from live team schedules.</td></tr>}</tbody>
  </table></div>
 </section>;
}
