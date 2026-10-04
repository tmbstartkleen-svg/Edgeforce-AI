'use client';

import {useEffect,useState} from 'react';

type Item={
 position:{id:number;venue:string;contractId:string;title:string;category:string;side:'YES'|'NO';quantity:number;avgEntryProbability:number;entryFee:number;openedAt:string};
 current?:{probability:number;executableExitProbability:number;executableBuyProbability:number};
 fair?:{sideProbability:number;source:string;confidence:number};
 action:'ADD'|'HOLD'|'TRIM'|'TAKE_PROFIT'|'EXIT'|'NO_SIGNAL';
 timing:'NOW'|'PATIENT'|'REVIEW';
 score:number;
 remainingEdge:number;
 unrealizedPnl:number;
 unrealizedRoi:number;
 addBelowProbability:number;
 takeProfitAboveProbability:number;
 reasons:string[];
 riskFlags:string[];
};
type Response={
 ok:boolean;generatedAt:string;summary:{openPositions:number;add:number;hold:number;trim:number;takeProfit:number;exit:number;noSignal:number;unrealizedPnl:number;entryCost:number;currentExitValue:number};
 intelligence:Item[];warnings?:string[];
};

const pct=(n:number)=>(n*100).toFixed(1)+'%';
const money=(n:number)=>(n<0?'-$':'$')+Math.abs(n).toFixed(2);

export default function PredictionPositionPanel(){
 const [data,setData]=useState<Response|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/prediction-positions/intelligence',{cache:'no-store'});
    if(!res.ok)throw new Error('prediction position intelligence unavailable');
    const json=await res.json() as Response;
    if(active){setData(json);setError('')}
   }catch(e){if(active)setError(e instanceof Error?e.message:'prediction position intelligence unavailable')}
  };
  void load();
  const timer=window.setInterval(()=>void load(),30000);
  return ()=>{active=false;window.clearInterval(timer)};
 },[]);

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div><div className="eyebrow">POSITION-AWARE EXIT ENGINE</div><h3>Live add, hold, trim, take-profit, and exit intelligence</h3></div>
   <div className="panelMeta"><span>{data?.summary.openPositions??0} open</span><span>{data?.summary.add??0} add</span><span>{data?.summary.takeProfit??0} take profit</span><span>{data?.summary.exit??0} exit</span></div>
  </div>
  {error&&<div className="v21Alert">{error}</div>}
  <div className="v21Stats">
   <div><small>UNREALIZED P/L</small><strong>{money(data?.summary.unrealizedPnl??0)}</strong><span>executable bid-side mark</span></div>
   <div><small>OPEN POSITIONS</small><strong>{data?.summary.openPositions??0}</strong><span>Kalshi + Polymarket manual ledger</span></div>
   <div><small>REDUCE</small><strong>{(data?.summary.trim??0)+(data?.summary.takeProfit??0)}</strong><span>rich relative to fair value</span></div>
   <div><small>NO SIGNAL</small><strong>{data?.summary.noSignal??0}</strong><span>insufficient independent fair value</span></div>
  </div>
  <div className="historyGrid">
   <div className="historyBox"><h4>Action queue</h4>
    {(data?.intelligence||[]).slice(0,10).map(item=><div className="historyRow" key={item.position.id}>
     <span>{item.action+' · '+item.position.side+' '+item.position.title}</span>
     <b>{item.score}/100</b>
     <small>{item.position.venue+' • '+item.timing+' • entry '+pct(item.position.avgEntryProbability)+' • exit '+(item.current?pct(item.current.executableExitProbability):'—')+' • P/L '+money(item.unrealizedPnl)}</small>
    </div>)}
    {!data?.intelligence?.length&&<div className="historyRow"><span>No prediction positions recorded</span><b>—</b><small>Record positions through the protected prediction-position API to activate position-aware guidance.</small></div>}
   </div>
   <div className="historyBox"><h4>Price discipline</h4>
    {(data?.intelligence||[]).slice(0,10).map(item=><div className="historyRow" key={'zone-'+item.position.id}>
     <span>{item.position.title}</span>
     <b>{item.action}</b>
     <small>{'add ≤ '+pct(item.addBelowProbability)+' • take-profit review ≥ '+pct(item.takeProfitAboveProbability)+' • fair '+(item.fair?pct(item.fair.sideProbability):'—')+(item.fair?' • '+item.fair.source:'')}</small>
    </div>)}
   </div>
  </div>
  <div className="historyNote">Position signals use executable bid/ask where available and prefer an independent cross-venue fair-value reference. They are analytical decision support, not guaranteed returns or automatic execution.</div>
 </section>;
}