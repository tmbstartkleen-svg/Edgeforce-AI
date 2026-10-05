'use client';

import {useEffect,useState} from 'react';
type Summary={ok:boolean;configured:boolean;totalProfiles:number;teams:number;likelyStarters:number;liveSnapshots:number;top:Array<{playerName:string;sport:string;teamKey:string;positionKey:string;games:number;starts:number;starterEvidenceGames:number;starterRate:number;averageMinutes:number;averageUsage:number;roleScore:number;depthRank:number;confidence:number}>};
const pct=(n:number)=>Math.round(n*1000)/10+'%';
export default function StartingLineupPanel(){
 const [data,setData]=useState<Summary|null>(null);
 useEffect(()=>{let on=true;fetch('/api/intelligence/starting-lineups',{cache:'no-store'}).then(r=>r.json()).then(x=>{if(on)setData(x)}).catch(()=>{});return()=>{on=false}},[]);
 return <section className="v21Card">
  <div className="v21CardHead"><div><div className="eyebrow">V66 LINEUP INTELLIGENCE</div><h3>Starters, depth charts & promotions</h3></div><span>{data?.configured?'ACTIVE':'WAITING'}</span></div>
  <div className="statRow"><div><small>PLAYERS</small><strong>{data?.totalProfiles??0}</strong></div><div><small>TEAMS</small><strong>{data?.teams??0}</strong></div><div><small>LIVE SNAPSHOTS</small><strong>{data?.liveSnapshots??0}</strong></div></div>
  <p className="muted">Combines confirmed starter flags with learned role scores, depth ranks and injury-driven promotion probability before player and game simulations run.</p>
  <div className="tableWrap"><table><thead><tr><th>Player</th><th>Sport</th><th>Team</th><th>Pos</th><th>Depth</th><th>Starts</th><th>Starter %</th><th>Minutes</th><th>Usage</th><th>Role</th></tr></thead>
   <tbody>{(data?.top||[]).slice(0,12).map(x=><tr key={x.playerName+x.sport+x.teamKey}><td><b>{x.playerName}</b></td><td>{x.sport}</td><td>{x.teamKey}</td><td>{x.positionKey}</td><td>#{x.depthRank}</td><td>{x.starts}/{x.games}</td><td>{pct(x.starterEvidenceGames?x.starterRate:x.roleScore)}{x.starterEvidenceGames?'':' est.'}</td><td>{x.averageMinutes.toFixed(1)}</td><td>{pct(x.averageUsage)}</td><td>{x.roleScore.toFixed(2)}</td></tr>)}{!data?.top?.length&&<tr><td colSpan={10} className="emptyRow">Depth-chart profiles populate from historical starter, minutes and usage data.</td></tr>}</tbody>
  </table></div>
 </section>;
}
