'use client';

import {useEffect,useState} from 'react';

type Row={
 domain:'SPORTS'|'MARKETS';dimension:string;key:string;sampleSize:number;wins:number;hitRate:number;
 averagePrediction:number;brier:number;logLoss:number;calibrationError:number;marketSkill:number|null;
 confidence:number;rating:number;evidence:string;
};
type Payload={sampleSize:number;sportsLeaders:Row[];marketsLeaders:Row[];warnings:string[]};

const pct=(n:number)=>(n*100).toFixed(1)+'%';

function RatingRows({rows}:{rows:Row[]}){
 return <>{rows.slice(0,8).map(row=><div className="historyRow" key={[row.domain,row.dimension,row.key].join('|')}>
  <span>{row.key}</span><b>{row.rating.toFixed(1)}</b>
  <small>{row.dimension} • n={row.sampleSize} • hit {pct(row.hitRate)} • Brier {row.brier.toFixed(3)}</small>
  <small>{row.evidence} • confidence {pct(row.confidence)}{row.marketSkill===null?'':' • market skill '+(row.marketSkill>=0?'+':'')+row.marketSkill.toFixed(3)}</small>
 </div>)}</>;
}

export default function ForecastSkillPanel(){
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/intelligence/skill-ratings',{cache:'no-store'});
    if(!res.ok)throw new Error('skill ratings unavailable');
    const json=await res.json() as Payload;
    if(active){setData(json);setError('')}
   }catch(e){if(active)setError(e instanceof Error?e.message:'skill ratings unavailable')}
  };
  void load();
  const timer=window.setInterval(()=>void load(),120000);
  return ()=>{active=false;window.clearInterval(timer)};
 },[]);
 return <section className="v21Panel">
  <div className="v21PanelHead">
   <div><div className="eyebrow">V103 CROSS-DOMAIN FORECAST SKILL</div><h3>Which models, sports, markets, venues and strategies are actually earning confidence?</h3></div>
   <div className="panelMeta"><span>{data?.sampleSize??0} settled forecasts</span><span>shrinkage adjusted</span></div>
  </div>
  {error&&<div className="v21Alert">{error}</div>}
  <div className="historyGrid">
   <div className="historyBox"><h4>Sports leaders</h4><RatingRows rows={data?.sportsLeaders||[]}/>{!data?.sportsLeaders?.length&&<div className="historyRow"><span>Not enough settled samples yet</span><b>—</b><small>25 settled forecasts are required before a slice appears as a leader.</small></div>}</div>
   <div className="historyBox"><h4>Prediction-market leaders</h4><RatingRows rows={data?.marketsLeaders||[]}/>{!data?.marketsLeaders?.length&&<div className="historyRow"><span>Not enough settled samples yet</span><b>—</b><small>Kalshi/Polymarket skill appears here after settled history accumulates.</small></div>}</div>
  </div>
  <div className="historyNote">Early Cash-Out is tracked as its own strategy key when its legs are graded. Ratings cannot independently promote a production model; existing holdout, drift and champion-defense gates still control promotion.</div>
 </section>;
}
