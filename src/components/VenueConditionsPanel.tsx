'use client';

import {useEffect,useState} from 'react';
type Row={sport:string;eventName:string;startTime:string;venueName?:string;indoor:boolean;surface?:string;elevationFt?:number;temperatureF?:number;humidityPct?:number;windMph?:number;gustMph?:number;precipProbability?:number;severity:number;totalEffect:number;homeEdge:number;volatility:number;confidence:number};
type Summary={configured:boolean;snapshots24h:number;profiles:number;severe24h:number;recent:Row[]};
const n=(v:number|undefined,d=0)=>Number.isFinite(v)?Number(v).toFixed(d):'-';
const pct=(v:number)=>Math.round(v*1000)/10+'%';
export default function VenueConditionsPanel(){
 const [data,setData]=useState<Summary|null>(null);
 useEffect(()=>{let on=true;fetch('/api/intelligence/venue-conditions',{cache:'no-store'}).then(r=>r.json()).then(x=>{if(on)setData(x)}).catch(()=>{});return()=>{on=false}},[]);
 return <section className="v21Card">
  <div className="v21CardHead"><div><div className="eyebrow">V68 VENUE CONDITIONS</div><h3>Weather, altitude & playing environment</h3></div><span>{data?.configured?'ACTIVE':'WAITING'}</span></div>
  <div className="statRow"><div><small>24H SNAPSHOTS</small><strong>{data?.snapshots24h??0}</strong></div><div><small>VENUE PROFILES</small><strong>{data?.profiles??0}</strong></div><div><small>SEVERE CONDITIONS</small><strong>{data?.severe24h??0}</strong></div></div>
  <p className="muted">Sport-aware temperature, humidity, precipitation, wind/gust, altitude, indoor status and surface effects feed expected scoring, pace, home edge and simulation volatility.</p>
  <div className="tableWrap"><table><thead><tr><th>Event / Venue</th><th>Temp</th><th>Wind</th><th>Precip</th><th>Elevation</th><th>Total Fx</th><th>Home Fx</th><th>Volatility</th></tr></thead>
   <tbody>{(data?.recent||[]).slice(0,12).map(x=><tr key={x.sport+x.eventName+x.startTime}><td><b>{x.eventName}</b><br/><small>{x.venueName||'-'} · {x.indoor?'INDOOR':x.surface||'OUTDOOR'}</small></td><td>{x.indoor?'controlled':n(x.temperatureF)+'°F'}</td><td>{x.indoor?'-':n(x.windMph)+' / '+n(x.gustMph)+' mph'}</td><td>{x.indoor?'-':n(x.precipProbability)+'%'}</td><td>{n(x.elevationFt)} ft</td><td>{x.totalEffect>=0?'+':''}{x.totalEffect.toFixed(2)}</td><td>{x.homeEdge>=0?'+':''}{x.homeEdge.toFixed(2)}</td><td>{pct(x.volatility)}</td></tr>)}{!data?.recent?.length&&<tr><td colSpan={8} className="emptyRow">Venue-condition snapshots populate from live event and forecast context.</td></tr>}</tbody>
  </table></div>
 </section>;
}
