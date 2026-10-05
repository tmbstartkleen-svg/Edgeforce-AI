'use client';

import {useEffect,useState} from 'react';

type Summary={
 ok:boolean;configured:boolean;totalFrames:number;learningProfiles:number;rosterSnapshots:number;
 sports:Array<{sport:string;frames:number;players:number;sampleConfidence:number}>;
 top:Array<{playerName:string;sport:string;statKey:string;sampleSize:number;playerForm:number;playerVolatility:number;playerHomeAway:number;playerOpponent:number;playerUsage:number;playerRosterContinuity:number;lastObservedAt:string}>;
};

export default function PlayerFeatureFramesPanel(){
 const [data,setData]=useState<Summary|null>(null);
 useEffect(()=>{let on=true;fetch('/api/intelligence/player-frames',{cache:'no-store'}).then(r=>r.json()).then(x=>{if(on)setData(x)}).catch(()=>{});return()=>{on=false}},[]);
 return <section className="v21Card">
  <div className="v21CardHead">
   <div><div className="eyebrow">V62 PLAYER INTELLIGENCE</div><h3>Simulation feature frames</h3></div>
   <span>{data?.configured?'LIVE DB':'WAITING'}</span>
  </div>
  <div className="statRow">
   <div><small>FRAMES</small><strong>{data?.totalFrames??0}</strong></div>
   <div><small>LEARNING PROFILES</small><strong>{data?.learningProfiles??0}</strong></div>
   <div><small>ROSTER SNAPSHOTS</small><strong>{data?.rosterSnapshots??0}</strong></div>
  </div>
  <p className="muted">Player form, volatility, home/away splits, opponent history, usage trend, roster continuity and live weather context are joined before simulation.</p>
  <div className="tableWrap">
   <table>
    <thead><tr><th>Player</th><th>Sport / Stat</th><th>N</th><th>Form</th><th>Vol</th><th>H/A</th><th>Opp</th><th>Roster</th></tr></thead>
    <tbody>
     {(data?.top||[]).slice(0,12).map(x=><tr key={x.playerName+x.sport+x.statKey}>
      <td><b>{x.playerName}</b></td><td>{x.sport} • {x.statKey}</td><td>{x.sampleSize}</td>
      <td>{x.playerForm.toFixed(2)}</td><td>{x.playerVolatility.toFixed(2)}</td><td>{x.playerHomeAway.toFixed(2)}</td><td>{x.playerOpponent.toFixed(2)}</td><td>{Math.round(x.playerRosterContinuity*100)}%</td>
     </tr>)}
     {!data?.top?.length&&<tr><td colSpan={8} className="emptyRow">Feature frames populate automatically as player history and live markets match.</td></tr>}
    </tbody>
   </table>
  </div>
 </section>;
}
