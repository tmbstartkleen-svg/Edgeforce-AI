'use client';

import {useEffect,useState} from 'react';

type Summary={
 ok:boolean;configured:boolean;totalProfiles:number;qualifiedProfiles:number;playerProfiles:number;qualifiedPlayerProfiles:number;opponents:number;
 top:Array<{sport:string;opponentName:string;positionKey:string;statKey:string;sampleSize:number;athleteCount:number;meanAllowed:number;leagueMean:number;relativeSignal:number;volatility:number;confidence:number}>;
 topPlayers:Array<{playerName:string;sport:string;opponentName:string;statKey:string;sampleSize:number;baselineMean:number;opponentMean:number;relativeSignal:number;confidence:number}>;
};
const pct=(n:number)=>Math.round(n*1000)/10+'%';

export default function OpponentMatchupPanel(){
 const [data,setData]=useState<Summary|null>(null);
 useEffect(()=>{let on=true;fetch('/api/intelligence/opponent-matchups',{cache:'no-store'}).then(r=>r.json()).then(x=>{if(on)setData(x)}).catch(()=>{});return()=>{on=false}},[]);
 return <section className="v21Card">
  <div className="v21CardHead">
   <div><div className="eyebrow">V64 MATCHUP LEARNING</div><h3>Opponent & positional matchup engine</h3></div>
   <span>{data?.configured?'ACTIVE':'WAITING'}</span>
  </div>
  <div className="statRow">
   <div><small>DEFENSE PROFILES</small><strong>{data?.totalProfiles??0}</strong></div>
   <div><small>PLAYER MATCHUPS</small><strong>{data?.playerProfiles??0}</strong></div>
   <div><small>OPPONENTS</small><strong>{data?.opponents??0}</strong></div>
  </div>
  <p className="muted">Learns baseline-adjusted team tendencies by stat, positional matchup strength, and exact player-vs-opponent history. Qualified player signals replace the overlapping V62 opponent term before V63 calibration and simulation.</p>
  <div className="tableWrap"><table>
   <thead><tr><th>Opponent</th><th>Sport</th><th>Pos</th><th>Stat</th><th>N</th><th>Athletes</th><th>Allowed</th><th>League</th><th>Signal</th><th>Conf</th></tr></thead>
   <tbody>
    {(data?.top||[]).slice(0,10).map(x=><tr key={x.sport+x.opponentName+x.positionKey+x.statKey}>
     <td><b>{x.opponentName}</b></td><td>{x.sport}</td><td>{x.positionKey}</td><td>{x.statKey}</td><td>{x.sampleSize}</td><td>{x.athleteCount}</td>
     <td>{x.meanAllowed.toFixed(1)}</td><td>{x.leagueMean.toFixed(1)}</td><td>{x.relativeSignal.toFixed(2)}</td><td>{pct(x.confidence)}</td>
    </tr>)}
    {!data?.top?.length&&<tr><td colSpan={10} className="emptyRow">Opponent profiles populate from the player game-history warehouse.</td></tr>}
   </tbody>
  </table></div>
  <div className="tableWrap"><table>
   <thead><tr><th>Player</th><th>Opponent</th><th>Sport / Stat</th><th>N</th><th>Baseline</th><th>Vs Opp</th><th>Adj</th><th>Conf</th></tr></thead>
   <tbody>
    {(data?.topPlayers||[]).slice(0,10).map(x=><tr key={x.playerName+x.sport+x.opponentName+x.statKey}>
     <td><b>{x.playerName}</b></td><td>{x.opponentName}</td><td>{x.sport} • {x.statKey}</td><td>{x.sampleSize}</td>
     <td>{x.baselineMean.toFixed(1)}</td><td>{x.opponentMean.toFixed(1)}</td><td>{x.relativeSignal.toFixed(2)}</td><td>{pct(x.confidence)}</td>
    </tr>)}
    {!data?.topPlayers?.length&&<tr><td colSpan={8} className="emptyRow">Exact player-vs-opponent adjustments activate as repeat matchup samples accumulate.</td></tr>}
   </tbody>
  </table></div>
 </section>;
}
