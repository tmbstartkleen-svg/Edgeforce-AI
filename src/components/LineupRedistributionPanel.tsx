'use client';

import {useEffect,useState} from 'react';
type Summary={ok:boolean;configured:boolean;totalProfiles:number;qualifiedProfiles:number;pairs:number;top:Array<{playerName:string;absentPlayer:string;sport:string;statKey:string;withGames:number;withoutGames:number;statLift:number;minutesLift:number;usageLift:number;confidence:number}>};
const pct=(n:number)=>Math.round(n*1000)/10+'%';
export default function LineupRedistributionPanel(){
 const [data,setData]=useState<Summary|null>(null);
 useEffect(()=>{let on=true;fetch('/api/intelligence/lineup-redistribution',{cache:'no-store'}).then(r=>r.json()).then(x=>{if(on)setData(x)}).catch(()=>{});return()=>{on=false}},[]);
 return <section className="v21Card">
  <div className="v21CardHead"><div><div className="eyebrow">V65 ROLE REDISTRIBUTION</div><h3>Injury-driven opportunity shifts</h3></div><span>{data?.configured?'ACTIVE':'WAITING'}</span></div>
  <div className="statRow"><div><small>PROFILES</small><strong>{data?.totalProfiles??0}</strong></div><div><small>QUALIFIED</small><strong>{data?.qualifiedProfiles??0}</strong></div><div><small>PLAYER PAIRS</small><strong>{data?.pairs??0}</strong></div></div>
  <p className="muted">Learns how each player&apos;s minutes, usage and stat production change when a meaningful teammate is absent, then activates those lifts from the live injury feed.</p>
  <div className="tableWrap"><table><thead><tr><th>Player</th><th>Absent teammate</th><th>Sport / Stat</th><th>With</th><th>Without</th><th>Stat lift</th><th>Min lift</th><th>Usage lift</th><th>Conf</th></tr></thead>
   <tbody>{(data?.top||[]).slice(0,12).map(x=><tr key={x.playerName+x.absentPlayer+x.statKey}><td><b>{x.playerName}</b></td><td>{x.absentPlayer}</td><td>{x.sport} • {x.statKey}</td><td>{x.withGames}</td><td>{x.withoutGames}</td><td>{x.statLift.toFixed(2)}</td><td>{x.minutesLift.toFixed(2)}</td><td>{x.usageLift.toFixed(2)}</td><td>{pct(x.confidence)}</td></tr>)}{!data?.top?.length&&<tr><td colSpan={9} className="emptyRow">Redistribution profiles populate as historical team-event samples accumulate.</td></tr>}</tbody>
  </table></div>
 </section>;
}
