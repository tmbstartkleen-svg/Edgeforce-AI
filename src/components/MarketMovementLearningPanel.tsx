'use client';

import {useEffect,useState} from 'react';
type Row={sport:string;eventId:string;marketKey:string;selectionKey:string;startTime:string;probabilityMove:number;recentMove:number;pointMove?:number;steamSignal:number;reversalSignal:number;closingLineSignal:number;confidence:number;snapshotCount:number};
type Profile={sport:string;marketKey:string;sampleCount:number;avgClvProbability:number;closingSkill:number;marketEfficiency:number;confidence:number};
type Summary={configured:boolean;snapshots24h:number;profiles:number;steam24h:number;reversals24h:number;recent:Row[];profileRows:Profile[]};
const pct=(n:number)=>Math.round(n*1000)/10+'%';
const signed=(n:number)=>`${n>=0?'+':''}${pct(n)}`;
export default function MarketMovementLearningPanel(){
 const [data,setData]=useState<Summary|null>(null);
 useEffect(()=>{let on=true;fetch('/api/intelligence/market-movement-learning',{cache:'no-store'}).then(r=>r.json()).then(x=>{if(on)setData(x)}).catch(()=>{});return()=>{on=false}},[]);
 return <section className="v21Card">
  <div className="v21CardHead"><div><div className="eyebrow">V69 MARKET LEARNING</div><h3>Movement, steam, reversals & closing line</h3></div><span>{data?.configured?'ACTIVE':'WAITING'}</span></div>
  <div className="statRow"><div><small>24H SNAPSHOTS</small><strong>{data?.snapshots24h??0}</strong></div><div><small>CLV PROFILES</small><strong>{data?.profiles??0}</strong></div><div><small>STEAM</small><strong>{data?.steam24h??0}</strong></div><div><small>REVERSALS</small><strong>{data?.reversals24h??0}</strong></div></div>
  <p className="muted">Canonical line history follows the same side through point changes, learns how efficiently each sport/market closes, and applies only a bounded confidence-weighted closing-line signal.</p>
  <div className="tableWrap"><table><thead><tr><th>Market</th><th>Move</th><th>Recent</th><th>Point</th><th>Steam</th><th>Reversal</th><th>Close signal</th><th>Samples</th></tr></thead>
   <tbody>{(data?.recent||[]).slice(0,12).map(x=><tr key={x.eventId+x.marketKey+x.selectionKey}><td><b>{x.selectionKey}</b><br/><small>{x.sport} · {x.marketKey}</small></td><td>{signed(x.probabilityMove)}</td><td>{signed(x.recentMove)}</td><td>{Number.isFinite(x.pointMove)?Number(x.pointMove).toFixed(1):'-'}</td><td>{x.steamSignal.toFixed(2)}</td><td>{x.reversalSignal.toFixed(2)}</td><td>{x.closingLineSignal.toFixed(2)}</td><td>{x.snapshotCount}</td></tr>)}{!data?.recent?.length&&<tr><td colSpan={8} className="emptyRow">Movement snapshots populate as live odds are refreshed.</td></tr>}</tbody>
  </table></div>
  {(data?.profileRows||[]).length>0&&<p className="muted">Largest learned samples: {(data?.profileRows||[]).slice(0,4).map(x=>`${x.sport.toUpperCase()} ${x.marketKey} (${x.sampleCount}, close skill ${x.closingSkill.toFixed(2)})`).join(' · ')}</p>}
 </section>;
}
