'use client';

import {useEffect,useState} from 'react';

type Candidate={
 id:string;sport:string;event:string;selection:string;market:string;action:'BUY_LOW_REVIEW'|'WATCH';
 score:number;simProbability:number;marketProbability:number;dynamicConfidence:number;
 modelMarketEdge:number;probabilityDrop:number;currentOdds:number;reason:string;
 riskFlags:string[];requiresGameStateConfirmation:true;
};
type Payload={
 ok:boolean;generatedAt:string;gameStateVerified:boolean;
 summary:{candidates:number;buyLowReview:number;watch:number;sports:string[]};
 candidates:Candidate[];warnings:string[];
};

const pct=(n:number)=>(n*100).toFixed(1)+'%';

export default function LiveComebackPanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/live-comeback',{cache:'no-store'});
    if(!res.ok)throw new Error('live comeback watch unavailable');
    const json=await res.json() as Payload;
    if(active){setData(json);setError('')}
   }catch(e){
    if(active)setError(e instanceof Error?e.message:'live comeback watch unavailable');
   }
  };
  void load();
  const timer=window.setInterval(()=>void load(),15000);
  return ()=>{active=false;window.clearInterval(timer)};
 },[]);

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div>
    <div className="eyebrow">V52 LIVE COMEBACK / HALFTIME BUY-LOW WATCH</div>
    <h3>Market moved against the side, but the simulation still holds</h3>
   </div>
   <div className="panelMeta">
    <span>{data?.summary.buyLowReview??0} review-ready</span>
    <span>{data?.summary.watch??0} watch</span>
    <span>game-state confirmation required</span>
   </div>
  </div>
  {error&&<div className="v21Alert">{error}</div>}
  <div className="historyGrid">
   <div className="historyBox">
    <h4>Buy-low review</h4>
    {(data?.candidates||[]).filter(x=>x.action==='BUY_LOW_REVIEW').slice(0,8).map(x=><div className="historyRow" key={x.id}>
     <span>{x.selection}</span><b>{x.score}/100</b>
     <small>{x.sport} • sim {pct(x.simProbability)} • market {pct(x.marketProbability)} • drop {pct(x.probabilityDrop)} • edge +{pct(x.modelMarketEdge)}</small>
     <small>{x.reason}</small>
    </div>)}
    {!data?.candidates?.some(x=>x.action==='BUY_LOW_REVIEW')&&<div className="historyRow"><span>No review-ready comeback setup</span><b>HOLD</b><small>Edgeforce will not manufacture a halftime/live entry without a qualifying move and model edge.</small></div>}
   </div>
   <div className="historyBox">
    <h4>Developing watch</h4>
    {(data?.candidates||[]).filter(x=>x.action==='WATCH').slice(0,8).map(x=><div className="historyRow" key={x.id}>
     <span>{x.selection}</span><b>{x.score}/100</b>
     <small>{x.sport} • sim {pct(x.simProbability)} • market {pct(x.marketProbability)} • drop {pct(x.probabilityDrop)} • conf {pct(x.dynamicConfidence)}</small>
    </div>)}
    {!data?.candidates?.some(x=>x.action==='WATCH')&&<div className="historyRow"><span>No developing setup</span><b>—</b><small>Watch rows require live-window timing plus actual line-history movement.</small></div>}
   </div>
  </div>
  <div className="historyNote">The V52 watch does not infer score, clock/period, possession/server, or live injuries from price movement. Any BUY_LOW_REVIEW signal still requires those live facts to be confirmed before a decision.</div>
 </section>;
}
