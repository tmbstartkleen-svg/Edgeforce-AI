'use client';

import {useMemo,useState} from 'react';
import {buildInstitutionalDesk,type DeskMarket,type DeskDecision,type DeskWindow} from '@/lib/institutionalDesk';

type ScannerPreview={
 positiveEvCount:number;
 arbitrageCount:number;
 quoteCount:number;
 rejectedUnverifiedQuotes?:number;
 rejectedStaleQuotes?:number;
 rejectedExpiredQuotes?:number;
 maxQuoteAgeMinutes?:number;
 positiveEv:Array<{
  key:string;sport:string;event:string;selection:string;market:string;
  book:string;odds:number;fairProbability:number;expectedValue:number;reference:string;
  quoteTimestamp?:string;
 }>;
};
type Props={
 rows:DeskMarket[];
 source:string;
 providerDegraded?:boolean;
 generatedAt?:string;
 scanner?:ScannerPreview|null;
 scannerStatus?:'CHECKING'|'VERIFIED'|'SOURCE_UNVERIFIED'|'ERROR';
 onInspect?:(item:{id:string;market:string;selection:string})=>void;
};

function pct(value:number){return Number.isFinite(value)?(value*100).toFixed(1)+'%':'—'}
function odds(value:number){return Number.isFinite(value)?(value>0?'+':'')+Math.round(value):'—'}
function schedule(value:string){
 const date=new Date(value);
 return Number.isFinite(date.getTime())?date.toLocaleString(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'}):'Schedule unconfirmed';
}
function label(window:DeskWindow){
 return window==='TODAY'?'Today':window==='TOMORROW'?'Tomorrow':'Next 7 days';
}

export default function InstitutionalTradeDesk({rows,source,providerDegraded,generatedAt,scanner,scannerStatus='CHECKING',onInspect}:Props){
 const [active,setActive]=useState<DeskWindow>('TODAY');
 const desk=useMemo(()=>buildInstitutionalDesk({rows,source,providerDegraded,generatedAt}),[rows,source,providerDegraded,generatedAt]);
 const counts={TODAY:desk.today.length,TOMORROW:desk.tomorrow.length,LATER:desk.later.length};
 const selected=active==='TODAY'?desk.today:active==='TOMORROW'?desk.tomorrow:desk.later;
 const ready=selected.filter(x=>x.status==='ENTRY_WINDOW');
 const watch=selected.filter(x=>x.status==='MONITOR');
 const passed=selected.filter(x=>x.status==='PASS');
 const visible=[...ready,...watch,...passed].slice(0,9);

 const renderDecision=(d:DeskDecision)=>(
  <article key={d.id} className={'institutionalPick '+d.status.toLowerCase()}>
   <div className="institutionalPickMain">
    <div className="institutionalPickHeader">
     <span className={'institutionalState '+d.status.toLowerCase()}>{d.status==='ENTRY_WINDOW'?'ENTRY WINDOW':d.status==='MONITOR'?'MONITOR':'PASS'}</span>
     <span>{d.sport} · {schedule(d.startTime)}</span>
    </div>
    <h3>{d.selection}</h3>
    <p>{d.event} · {d.market}</p>
    <div className="institutionalPickContext">{d.venue} · {d.venueType==='SPORTSBOOK'?odds(d.odds):'Exchange'} · {d.simulationRuns.toLocaleString()} runs reported</div>
   </div>
   <div className="institutionalPickStats">
    <div><small>Estimated EV</small><strong>{pct(d.expectedValue)}</strong></div>
    <div><small>Fair / market</small><strong>{pct(d.fairProbability)} / {pct(d.marketProbability)}</strong></div>
    <div><small>Model confidence</small><strong>{pct(d.confidence)}</strong></div>
    <div><small>Analysis score</small><strong>{d.score}/100</strong></div>
   </div>
   <div className="institutionalPickAction">
    <strong>Price ceiling: {pct(d.entryPriceProbability)}{d.venueType==='SPORTSBOOK'?' · odds '+odds(d.entryMinAmericanOdds)+' or better':''}</strong>
    <p>{d.flags[0]||d.reasons[2]}</p>
    {d.flags.length>1&&<small>{d.flags.length-1} additional check{d.flags.length===2?'':'s'} required</small>}
    <button type="button" disabled={!onInspect} onClick={()=>onInspect?.({id:d.id,market:d.market,selection:d.selection})}>Inspect model and market</button>
   </div>
  </article>
 );

 return <section id="trade-desk" className="institutionalDesk" aria-label="Institutional Edge Desk">
  <div className="institutionalDeskHead">
   <div>
    <div className="eyebrow">V196 · INSTITUTIONAL EDGE DESK</div>
    <h2>Find the price. Verify the edge. Choose the time.</h2>
    <p>Decision-grade opportunities, not simply the highest simulation percentages. Every entry is conditional on the current offered price and model evidence.</p>
   </div>
   <div className={'institutionalFeed '+(desk.boardHealthy?'healthy':'caution')}>{desk.boardHealthy?'LIVE DATA CHECKED':'NO VERIFIED ENTRY FEED'}</div>
  </div>
  <div className="institutionalSummary" aria-label="Decision summary">
   <div><small>Entry windows</small><strong>{desk.ready}</strong><span>Live, price and uncertainty gates passed</span></div>
   <div><small>Monitor</small><strong>{desk.monitor}</strong><span>Future-day candidates or changing prices</span></div>
   <div><small>Pass / blocked</small><strong>{desk.passed}</strong><span>Do not infer a trade from high win odds</span></div>
   <div><small>Quote screen</small><strong>{scanner?.positiveEvCount??'—'}</strong><span>Cross-book +EV indications; recheck independently</span></div>
  </div>
  {!desk.boardHealthy&&<div className="institutionalWarning" role="status">No trade is classified as ready while the live data, quote age, or provider health check is unavailable. The board may still display candidates for research.</div>}
  {desk.ready===0&&<div className="institutionalNeutral" role="status">No verified immediate entry clears all the gates. The correct decision can be to wait; a high model win rate alone is not an advantage.</div>}
  <div className="institutionalDayTabs" role="group" aria-label="Opportunity day">
   {(['TODAY','TOMORROW','LATER'] as const).map(day=><button key={day} type="button" aria-pressed={active===day} className={active===day?'active':''} onClick={()=>setActive(day)}>{label(day)} <span>{counts[day]}</span></button>)}
  </div>
  <div className="institutionalList">
   <div className="institutionalListHeading"><h3>{label(active)} · ranked by validated edge</h3><span>{visible.length} shown of {selected.length}</span></div>
   {visible.map(renderDecision)}
   {!selected.length&&<div className="institutionalEmpty">No eligible scheduled markets in this window from the current qualified board. Broader schedule coverage appears under Games &amp; Schedules; no speculative picks are inserted.</div>}
  </div>
  <div className="institutionalReference">
   <div><h3>Cross-book price gaps to verify</h3><p>Price-only signals are not independent model projections. These do not automatically qualify as trades.</p>
    <p className="institutionalIntegrity" role="status">Scanner: {scannerStatus.replaceAll('_',' ')} · {scanner?.quoteCount??0} verified quotes · {scanner?.rejectedUnverifiedQuotes??0} missing timestamps · {scanner?.rejectedStaleQuotes??0} stale · {scanner?.rejectedExpiredQuotes??0} expired. Independent reference book required.</p>
   </div>
   <div className="institutionalReferenceRows">
    {(scanner?.positiveEv||[]).slice(0,4).map(x=><div key={x.key+'|'+x.selection} className="institutionalReferenceRow">
     <div><b>{x.selection}</b><small>{x.sport} · {x.event} · {x.book} {odds(x.odds)}</small></div>
     <div><strong>{pct(x.expectedValue)} estimated EV</strong><small>{x.reference} · quoted {x.quoteTimestamp?new Date(x.quoteTimestamp).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):'time unverified'} · recheck quote and settlement rules</small></div>
    </div>)}
    {!scanner?.positiveEv?.length&&<p className="institutionalEmpty">{scannerStatus==='VERIFIED'?'No independent fresh +EV prices meet the scanner checks.':'No verified independent live price scan is available; no execution signal is implied.'}</p>}
   </div>
  </div>
  <p className="institutionalFootnote">Model-based decision support only; not automated betting or financial advice. Live quotes can change, models can be miscalibrated, and correlated positions can lose together. Entry price, limits, commissions, injuries and market settlement rules must be verified before placing any trade.</p>
 </section>;
}
