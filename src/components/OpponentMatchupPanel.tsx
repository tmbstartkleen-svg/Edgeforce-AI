'use client';

import {useEffect,useState} from 'react';

type Summary={
 ok:boolean;configured:boolean;totalProfiles:number;qualifiedProfiles:number;opponents:number;
 top:Array<{sport:string;opponentName:string;positionKey:string;statKey:string;sampleSize:number;meanAllowed:number;leagueMean:number;relativeSignal:number;volatility:number;confidence:number}>;
};
const pct=(n:number)=>Math.round(n*1000)/10+'%';

export default function OpponentMatchupPanel(){
 const [data,setData]=useState<Summary|null>(null);
 useEffect(()=>{let on=true;fetch('/api/intelligence/opponent-matchups',{cache:'no-store'}).then(r=>r.json()).then(x=>{if(on)setData(x)}).catch(()=>{});return()=>{on=false}},[]);
 return <section className="v21Card">
  <div className="v21CardHead">
   <div><div className="eyebrow">V64 MATCHUP LEARNING</div><h3>Opponent tendency engine</h3></div>
   <span>{data?.configured?'ACTIVE':'WAITING'}</span>
  </div>
  <div className="statRow">
   <div><small>PROFILES</small><strong>{data?.totalProfiles??0}</strong></div>
   <div><small>QUALIFIED</small><strong>{data?.qualifiedProfiles??0}</strong></div>
   <div><small>OPPONENTS</small><strong>{data?.opponents??0}</strong></div>
  </div>
  <p className="muted">Learns what each opponent allows by sport, position and player-stat, then applies confidence-scaled matchup signals before simulation.</p>
  <div className="tableWrap"><table>
   <thead><tr><th>Opponent</th><th>Sport</th><th>Pos</th><th>Stat</th><th>N</th><th>Allowed</th><th>League</th><th>Signal</th><th>Conf</th></tr></thead>
   <tbody>
    {(data?.top||[]).slice(0,12).map(x=><tr key={x.sport+x.opponentName+x.positionKey+x.statKey}>
     <td><b>{x.opponentName}</b></td><td>{x.sport}</td><td>{x.positionKey}</td><td>{x.statKey}</td><td>{x.sampleSize}</td>
     <td>{x.meanAllowed.toFixed(1)}</td><td>{x.leagueMean.toFixed(1)}</td><td>{x.relativeSignal.toFixed(2)}</td><td>{pct(x.confidence)}</td>
    </tr>)}
    {!data?.top?.length&&<tr><td colSpan={9} className="emptyRow">Opponent profiles populate from the player game-history warehouse.</td></tr>}
   </tbody>
  </table></div>
 </section>;
}
