'use client';

import {useEffect,useMemo,useState} from 'react';

type Quote={
 id:string;domain:'SPORTS'|'MARKETS';venue:string;venueType:string;category:string;title:string;
 impliedProbability:number;modelProbability:number;edge:number;americanOdds?:number;volume?:number;liquidity?:number;
};
type Payload={generatedAt:string;summary:Record<string,number>;quotes:Quote[];warnings:string[]};

function pct(value:number){return (value*100).toFixed(1)+'%'}
function money(value?:number){
 if(!value)return '—';
 if(value>=1_000_000)return '$'+(value/1_000_000).toFixed(1)+'M';
 if(value>=1_000)return '$'+(value/1_000).toFixed(1)+'K';
 return '$'+Math.round(value);
}

export default function UniversalMarketsPanel(){
 const [domain,setDomain]=useState<'MARKETS'|'SPORTS'>('MARKETS');
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let alive=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/universal-markets?domain='+domain,{cache:'no-store'});
    if(!res.ok)throw new Error('Unable to load universal markets');
    const json=await res.json() as Payload;
    if(alive){setData(json);setError('')}
   }catch(e){if(alive)setError(e instanceof Error?e.message:'Unable to load')}
  };
  void load();
  const timer=window.setInterval(()=>void load(),30000);
  return()=>{alive=false;window.clearInterval(timer)};
 },[domain]);
 const rows=useMemo(()=>[...(data?.quotes||[])].sort((a,b)=>Math.abs(b.edge)-Math.abs(a.edge)).slice(0,80),[data]);
 return <main className="pmMobile">
  <header className="pmTop"><div><div className="pmEyebrow">EDGEFORCE UNIVERSAL MARKETS</div><h1>{domain==='MARKETS'?'Prediction Markets':'Sports Markets'}</h1></div><div className="pmLive"><span/>LIVE</div></header>
  <nav className="pmTabs">
   <button className={domain==='MARKETS'?'active':''} onClick={()=>setDomain('MARKETS')}>Markets</button>
   <button className={domain==='SPORTS'?'active':''} onClick={()=>setDomain('SPORTS')}>Sports</button>
  </nav>
  {error&&<div className="pmAlert">{error}</div>}
  <section className="pmHero"><div><small>TRACKED</small><strong>{(data?.summary?.total||0).toLocaleString()}</strong><span>Analytics-only unified pricing layer</span></div><div className="pmHeroStats"><div><small>Kalshi</small><b>{data?.summary?.kalshi||0}</b></div><div><small>Poly</small><b>{data?.summary?.polymarket||0}</b></div><div><small>DK</small><b>{data?.summary?.draftKings||0}</b></div><div><small>FD</small><b>{data?.summary?.fanDuel||0}</b></div></div></section>
  {data?.warnings?.[0]&&<div className="pmNotice">{data.warnings[0]}</div>}
  <section className="pmStack">
   <div className="pmSectionHead"><div><small>{domain}</small><h2>Largest model-market gaps</h2></div><span>{rows.length}</span></div>
   {rows.map(row=><article className="pmCard compact" key={row.id}>
    <div className="pmCardTop"><span className={'pmVenue '+row.venue.toLowerCase().replace(/\s+/g,'')}>{row.venue}</span><b className="pmGap">{row.edge>=0?'+':''}{(row.edge*100).toFixed(1)} pts</b></div>
    <h3>{row.title}</h3>
    <div className="pmCompare">
     <div><small>Market</small><b>{pct(row.impliedProbability)}</b></div>
     <div><small>Model</small><b>{pct(row.modelProbability)}</b></div>
     <div><small>{row.americanOdds?'Odds':'Liquidity'}</small><b>{row.americanOdds??money(row.liquidity)}</b></div>
    </div>
    <p>{row.category} · {row.venueType.replace(/_/g,' ').toLowerCase()} · analytics only</p>
   </article>)}
   {!rows.length&&<div className="pmEmpty">No current rows from configured market feeds.</div>}
  </section>
 </main>;
}
