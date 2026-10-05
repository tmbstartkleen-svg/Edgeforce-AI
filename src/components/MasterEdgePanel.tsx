'use client';

import {useEffect,useState} from 'react';

type Row={
 id:string;domain:'SPORTS'|'MARKETS';category:string;venue:string;title:string;
 modelProbability:number;marketProbability:number;edge:number;confidence:number;
 routerWeight:number;liquidityScore:number;freshnessScore:number;masterScore:number;
 tier:'A+'|'A'|'B'|'WATCH';startOrExpiry?:string;sourceType:string;
};
type Payload={
 totalCandidates:number;board:Row[];sports:Row[];markets:Row[];
 tiers:{aPlus:number;a:number;b:number;watch:number};
 safeguards:{maxDomainShare:number;maxCategoryShare:number;minSportsProbability:number;minMarketEdge:number};
 notes:string[];
};

const pct=(n:number)=>(n*100).toFixed(1)+'%';
const pts=(n:number)=>(n>=0?'+':'')+(n*100).toFixed(1)+' pts';

export default function MasterEdgePanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/intelligence/master-edge?limit=50',{cache:'no-store'});
    if(!res.ok)throw new Error('master edge board unavailable');
    const json=await res.json() as Payload;
    if(active){setData(json);setError('')}
   }catch(e){if(active)setError(e instanceof Error?e.message:'master edge board unavailable')}
  };
  void load();
  const timer=window.setInterval(()=>void load(),60000);
  return ()=>{active=false;window.clearInterval(timer)};
 },[]);

 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div>
    <div className="eyebrow">V105 MASTER EDGE</div>
    <h3>Opportunity Fusion & Master Ranking</h3>
   </div>
   <div className="panelMeta">
    <span>{data?.board.length||0} ranked</span>
    <span>A+ {data?.tiers.aPlus||0}</span>
    <span>A {data?.tiers.a||0}</span>
   </div>
  </div>

  {error&&<div className="v21Alert">{error}</div>}

  <div className="historyGrid">
   <div className="historyBox">
    <h4>Master Top Opportunities</h4>
    {(data?.board||[]).slice(0,12).map((x,index)=><div className="historyRow" key={x.id}>
     <span>#{index+1} · {x.title}</span><b>{x.tier} · {(x.masterScore*100).toFixed(1)}</b>
     <small>{x.domain} • {x.category} • {x.venue} • edge {pts(x.edge)}</small>
     <small>model {pct(x.modelProbability)} • market {pct(x.marketProbability)} • confidence {pct(x.confidence)} • router {pct(x.routerWeight)}</small>
    </div>)}
    {!data?.board?.length&&<div className="historyRow"><span>No qualified fused opportunities</span><b>HOLD</b><small>The Master Edge board will stay empty rather than force low-quality candidates.</small></div>}
   </div>

   <div className="historyBox">
    <h4>Domain Balance</h4>
    <div className="historyRow"><span>Sports</span><b>{data?.sports.length||0}</b><small>Sportsbook opportunities remain under the Sports models and bankroll.</small></div>
    <div className="historyRow"><span>Prediction Markets</span><b>{data?.markets.length||0}</b><small>Kalshi/Polymarket/non-sports opportunities remain under the Markets models and bankroll.</small></div>
    <div className="historyRow"><span>Maximum domain share</span><b>{pct(data?.safeguards.maxDomainShare||0)}</b><small>Prevents one domain from taking over the entire master board.</small></div>
    <div className="historyRow"><span>Maximum category share</span><b>{pct(data?.safeguards.maxCategoryShare||0)}</b><small>Prevents one sport or market category from crowding out the rest.</small></div>
   </div>
  </div>

  <div className="historyNote">Master Edge is a cross-domain ranking layer only. It does not merge Sports and prediction-market models, settlement rules, bankrolls, or execution. It ranks where EdgeForce should look first.</div>
 </section>;
}
