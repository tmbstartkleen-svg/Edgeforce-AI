'use client';
import {useEffect,useState} from 'react';
import Sparkline from './Sparkline';

export default function MarketDrilldown({marketId,onClose}:{marketId:string;onClose:()=>void}){
 const [detail,setDetail]=useState<any>(null);
 const [lines,setLines]=useState<any[]>([]);
 const [scenario,setScenario]=useState<any>(null);
 const [busy,setBusy]=useState(false);

 useEffect(()=>{
  Promise.all([
   fetch('/api/market/'+encodeURIComponent(marketId),{cache:'no-store'}).then(r=>r.json()),
   fetch('/api/market/'+encodeURIComponent(marketId)+'/lines',{cache:'no-store'}).then(r=>r.json())
  ]).then(([d,l])=>{setDetail(d);setLines(l.points||[])}).catch(()=>{});
 },[marketId]);

 const runScenario=async()=>{
  setBusy(true);
  try{
   const res=await fetch('/api/what-if',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({marketId,context:{lineMovePct:.03,homeAdvantage:.01},bankroll:1000})});
   setScenario(await res.json());
  }finally{setBusy(false)}
 };

 const council=detail?.council;
 const scan=detail?.scan?.[0];
 return <div className="drillOverlay" onClick={onClose}>
  <div className="drillPanel" onClick={e=>e.stopPropagation()}>
   <div className="drillHead"><div><div className="eyebrow">MARKET DRILL-DOWN</div><h3>{detail?.market?.event||marketId}</h3></div><button onClick={onClose}>CLOSE</button></div>
   {!detail&&<p className="emptyState">Loading market detail…</p>}
   {detail&&<>
    <div className="drillStats">
     <div><small>SELECTION</small><strong>{detail.market?.selection||'—'}</strong></div>
     <div><small>MARKET P</small><strong>{detail.market?Number(detail.market.marketProb*100).toFixed(1)+'%':'—'}</strong></div>
     <div><small>ENSEMBLE</small><strong>{council?Number(council.ensemble*100).toFixed(1)+'%':'—'}</strong></div>
     <div><small>EV</small><strong>{scan?Number(scan.expectedValue*100).toFixed(1)+'%':'—'}</strong></div>
    </div>
    <div className="drillGrid">
     <div className="consoleCard">
      <div className="eyebrow">MODEL COUNCIL</div>
      {(council?.votes||[]).map((v:any)=><div className="voteRow" key={v.name}><span>{v.name}</span><b>{(Number(v.prob)*100).toFixed(1)}%</b><small>{(Number(v.weight)*100).toFixed(0)}% weight</small></div>)}
     </div>
     <div className="consoleCard">
      <div className="eyebrow">LINE MOVEMENT</div>
      <Sparkline label="American odds" values={lines.map((x:any)=>Number(x.odds))}/>
      <Sparkline label="Implied probability" values={lines.map((x:any)=>Number(x.impliedProbability||0)*100)}/>
     </div>
    </div>
    <div className="scenarioBox">
     <div><div className="eyebrow">READ-ONLY WHAT-IF</div><p>Applies a hypothetical 3% line move and +1% home adjustment without writing to historical records.</p></div>
     <button disabled={busy} onClick={runScenario}>{busy?'RUNNING…':'RUN SCENARIO'}</button>
    </div>
    {scenario&&<div className="scenarioResult"><b>Scenario result</b><span>{'Repriced probability '+(Number(scenario.repriced?.modelProb||0)*100).toFixed(1)+'%'}</span><span>{'Portfolio positions '+(scenario.portfolio?.positions?.length||0)}</span></div>}
   </>}
  </div>
 </div>;
}
