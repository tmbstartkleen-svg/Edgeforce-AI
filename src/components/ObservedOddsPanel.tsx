'use client';

import {useState} from 'react';
import {evaluatePulseEvidence,isPulseAmericanPrice} from '@/lib/pulseEvidence';
import {OBSERVED_ODDS_MAX_AGE_MS,type ObservedOddsSnapshot} from '@/lib/observedOdds';
import {researchSourceAge,type ResearchRow} from '@/lib/dailyWeeklyResearch';

export type ObservedProviderAttempt={providerId:string;ok:boolean;skipped?:boolean;circuitState?:string;error?:string;observedReferenceMarkets?:number};
type Props={observedOdds?:ObservedOddsSnapshot;pulse?:unknown;providerAttempts?:ObservedProviderAttempt[];
 now:number;stale:boolean;loading:boolean};
const timestamp=(value:unknown)=>typeof value==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)?Date.parse(value):NaN;
const time=(value:unknown)=>{
 const parsed=timestamp(value);
 return Number.isFinite(parsed)?new Date(parsed).toLocaleString('en-US',{
  timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'
 }):'Time unavailable';
};
const odds=(value:number)=>(value>0?'+':'')+value;
const breakEven=(value:number)=>(100*(value<0?-value/(-value+100):100/(value+100))).toFixed(1)+'%';
const age=(milliseconds:number)=>milliseconds<60000?'under 1 minute':(milliseconds/60000).toFixed(1)+' minutes';

export function hasCurrentBoardSnapshot(generatedAt:unknown,now:number,failed=false):boolean{
 const generated=timestamp(generatedAt);
 return !failed&&Number.isFinite(now)&&Number.isFinite(generated)&&generated<=now&&now-generated<=120000;
}

export function currentBoardRows<T extends ResearchRow>(rows:T[],generatedAt:string,now:number,failed=false):T[]{
 if(!hasCurrentBoardSnapshot(generatedAt,now,failed))return [];
 const current=rows.filter(row=>{
  const sourceAge=researchSourceAge(row,generatedAt,new Date(now));
  return sourceAge!==undefined&&sourceAge<=20&&timestamp(row.startTime)>now;
 });
 // Preserve the array while only the display clock advances, avoiding extra dependent requests.
 return current.length===rows.length?rows:current;
}

export function referenceOddsView(observedOdds:ObservedOddsSnapshot|undefined,now:number,
 filters:{sport?:string;market?:string;limit?:number}={}){
 const observationLimit=typeof observedOdds?.maxObservationAgeMs==='number'&&Number.isFinite(observedOdds.maxObservationAgeMs)&&observedOdds.maxObservationAgeMs>0
  ?Math.min(OBSERVED_ODDS_MAX_AGE_MS,observedOdds.maxObservationAgeMs):OBSERVED_ODDS_MAX_AGE_MS;
 const supplied=Array.isArray(observedOdds?.referenceQuotes)?observedOdds.referenceQuotes:[];
 const current=supplied.slice(0,200).filter(row=>{
  const observed=timestamp(row.quoteObservedAt),start=timestamp(row.startTime);
  return row.evidenceClass==='OBSERVED_REFERENCE'&&isPulseAmericanPrice(row.odds)&&
   Number.isFinite(observed)&&observed<=now&&now-observed<=observationLimit&&Number.isFinite(start)&&start>now;
 });
 const sportRows=filters.sport?current.filter(row=>row.sport===filters.sport):current;
 const matching=filters.market?sportRows.filter(row=>row.market===filters.market):sportRows;
 const sports=[...new Set([...current.map(row=>row.sport),...(filters.sport?[filters.sport]:[])])].sort();
 const markets=[...new Set([...sportRows.map(row=>row.market),...(filters.market?[filters.market]:[])])].sort();
 const limit=typeof filters.limit==='number'&&Number.isFinite(filters.limit)?Math.max(25,Math.min(200,Math.floor(filters.limit))):25;
 return {current,sports,markets,matchingCount:matching.length,quotes:matching.slice(0,limit)};
}

export default function ObservedOddsPanel({observedOdds,pulse,providerAttempts=[],now,stale,loading}:Props){
 const [sport,setSport]=useState(''),[market,setMarket]=useState(''),[visibleCount,setVisibleCount]=useState(25);
 const {current,sports,markets,matchingCount,quotes}=referenceOddsView(observedOdds,now,{sport,market,limit:visibleCount});
 const pulseEvidence=evaluatePulseEvidence(pulse,now);
 const pulsePrices=pulseEvidence.rows.flatMap(row=>row.prices.map(price=>({...row,price}))).slice(0,25);
 const attempts=providerAttempts;
 return <section className="v21Panel" id="observed-odds" aria-label="Observed sportsbook prices">
  <div className="v21PanelHead">
   <div><div className="eyebrow">OBSERVED SPORTSBOOK PRICES</div><h3>Reference odds and current price observations</h3></div>
   <div className="panelMeta"><span>{loading?'Loading observations':stale?'Last snapshot · refresh unavailable':'Partial source coverage'}</span></div>
  </div>
  <div className="v21Stats">
   <div><small>REFERENCE PRICES</small><strong>{loading?'—':current.length}</strong><span>Upcoming events observed within five minutes</span></div>
   <div><small>OPEN PULSE PRICES</small><strong>{loading?'—':pulseEvidence.priceCount}</strong><span>Snapshot and market updates within two minutes</span></div>
   <div><small>PRICE MEASURE</small><strong>Break-even</strong><span>Calculated from the quoted price only</span></div>
   <div><small>RECOMMENDATION STATUS</small><strong>Observation only</strong><span>Independent forecasts and value are not established here</span></div>
  </div>
  {stale&&<p className="v21Alert" role="status">The latest board request failed or expired. Retained observations show their original times; current recommendation controls are unavailable.</p>}
  <p className="historyNote">Reference prices are observations from the named source. An observation time records when the feed was read; it does not establish when the bookmaker last changed the price. All times below use Eastern Time.</p>
  <div className="v21ControlPanel">
   <div className="controlGroup"><label htmlFor="reference-odds-sport">Sport</label>
    <select id="reference-odds-sport" aria-label="Reference odds sport" value={sport} onChange={event=>{setSport(event.target.value);setMarket('');setVisibleCount(25)}}>
     <option value="">All sports</option>{sports.map(value=><option key={value} value={value}>{value}</option>)}
    </select></div>
   <div className="controlGroup"><label htmlFor="reference-odds-market">Market</label>
    <select id="reference-odds-market" aria-label="Reference odds market" value={market} onChange={event=>{setMarket(event.target.value);setVisibleCount(25)}}>
     <option value="">All markets</option>{markets.map(value=><option key={value} value={value}>{value}</option>)}
    </select></div>
  </div>
  <div className="tableWrap"><table aria-label="Observed reference odds">
   <thead><tr><th scope="col">Start · Eastern</th><th scope="col">Sport / event</th><th scope="col">Market / selection</th><th scope="col">Book / price</th><th scope="col">Break-even</th><th scope="col">Observation evidence</th></tr></thead>
   <tbody>{quotes.map((quote,index)=>{
    const source=timestamp(quote.sourceTimestamp),observed=timestamp(quote.quoteObservedAt);
    return <tr key={`${quote.id}:${quote.providerId}:${index}`}>
     <td>{time(quote.startTime)}</td><td><b>{quote.sport} · {quote.league}</b><small>{quote.event}</small></td>
     <td><b>{quote.selection}</b><small>{quote.market}</small></td>
     <td>{quote.bookmaker}<small>{odds(quote.odds)}</small></td><td>{breakEven(quote.odds)}</td>
     <td>{quote.providerId}<small>Observed {time(quote.quoteObservedAt)} · {age(now-observed)} ago</small>
      <small>{Number.isFinite(source)&&source<=observed?`Book update ${time(quote.sourceTimestamp)} · ${age(now-source)} ago`:'Book update time not supplied'}</small></td>
    </tr>;
   })}</tbody>
  </table></div>
  {!quotes.length&&<p className="historyNote">{loading?'Loading source observations…':current.length?'No current reference prices match these filters.':'No current reference prices were returned for upcoming events.'}</p>}
  {quotes.length>0&&<div className="historyNote">Showing {quotes.length} of {matchingCount} matching current reference observations in this partial snapshot.
   {matchingCount>quotes.length&&<div><button type="button" className="ackBtn" onClick={()=>setVisibleCount(count=>Math.min(200,count+25))}>Show more ({Math.min(25,matchingCount-quotes.length)})</button></div>}
  </div>}
  <details className="historyBox" open={quotes.length===0&&pulsePrices.length>0}>
   <summary>FanDuel-labelled price tape · {pulseEvidence.priceCount} current prices</summary>
   <p className="historyNote">FanLineWire supplies fixture, market and selection identifiers. Outcome names and scheduled starts are not verified in this tape. These prices stay separate from named selections and model forecasts.</p>
   <div className="tableWrap"><table aria-label="Observed pulse prices">
    <thead><tr><th scope="col">Sport / fixture</th><th scope="col">Market</th><th scope="col">Selection identifier</th><th scope="col">Observed price</th><th scope="col">Updated · Eastern</th></tr></thead>
    <tbody>{pulsePrices.map((row,index)=><tr key={`${row.fixture}:${row.market}:${row.price.selectionId}:${index}`}>
     <td>{row.sport}<small>{row.fixture}</small></td><td>{row.market}<small>OPEN · {row.inplay?'In play':'Pregame flag'}</small></td>
     <td>{row.price.selectionId}<small>Outcome name unverified</small></td><td>{odds(row.price.american)}</td>
     <td>{time(row.updatedAt)}<small>{age(row.sourceAgeMs)} ago</small></td>
    </tr>)}</tbody>
   </table></div>
   {!pulsePrices.length&&<p className="historyNote">{loading?'Loading price tape…':'No current OPEN markets with valid prices and source times are available in this snapshot.'}</p>}
   {pulseEvidence.priceCount>pulsePrices.length&&<p className="historyNote">Showing {pulsePrices.length} of {pulseEvidence.priceCount} current pulse prices.</p>}
  </details>
  <details className="historyBox" open={current.length===0&&attempts.some(attempt=>!attempt.ok)}>
   <summary>Provider response details</summary>
   {attempts.map((attempt,index)=><div className="historyRow" key={`${attempt.providerId}:${index}`}>
    <span>{attempt.providerId}</span><b>{typeof attempt.observedReferenceMarkets==='number'&&Number.isFinite(attempt.observedReferenceMarkets)&&attempt.observedReferenceMarkets>0?'Reference only':attempt.skipped?'Paused':attempt.ok?'Response accepted':'Unavailable'}</b>
    <small>{attempt.error||'No failure reported'}{attempt.circuitState?` · Circuit ${attempt.circuitState}`:''}</small>
   </div>)}
   {!attempts.length&&<p className="historyNote">No provider-attempt details were returned with this snapshot.</p>}
   <p className="historyNote">Details reflect this response. Rechecking the page does not restore exhausted provider credits. Reference prices and pulse observations do not establish an executable offer or independent model advantage.</p>
  </details>
 </section>;
}
