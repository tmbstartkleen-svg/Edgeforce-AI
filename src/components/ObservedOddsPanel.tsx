'use client';

import {useState} from 'react';
import {evaluatePulseEvidence,isPulseAmericanPrice} from '@/lib/pulseEvidence';
import {OBSERVED_ODDS_MAX_AGE_MS,type ObservedOddsSnapshot} from '@/lib/observedOdds';
import {researchSourceAge,type ResearchRow} from '@/lib/dailyWeeklyResearch';
import type {PriceReview} from '@/lib/providers/priceReview';
import type {LiveBoardCoreStatus} from '@/lib/liveBoardContinuity';
import type {ProviderDiagnostics,ProviderFailureKind,ProviderRequestDiagnostic} from '@/lib/providers/types';

export type ObservedProviderAttempt={providerId:string;ok:boolean;skipped?:boolean;circuitState?:string;error?:string;observedReferenceMarkets?:number;diagnostics?:ProviderDiagnostics};
export type ObservedSourceCollection={partial:boolean;deadlineReached:boolean;deadlineMs:number;concurrency:number;
 sources:Array<{id:string;label:string;status:'FETCHED'|'CACHED'|'FAILED'|'DEFERRED';gameCount:number;referenceCount:number;observedAt?:string;error?:string}>};
type Props={observedOdds?:ObservedOddsSnapshot;pulse?:unknown;providerAttempts?:ObservedProviderAttempt[];
 priceReview?:PriceReview|null;coreStatus?:LiveBoardCoreStatus;collection?:ObservedSourceCollection;now:number;stale:boolean;loading:boolean};
const timestamp=(value:unknown)=>typeof value==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)?Date.parse(value):NaN;
const easternTime=new Intl.DateTimeFormat('en-US',{
 timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'
});
const time=(value:unknown)=>{
 const parsed=timestamp(value);
 return Number.isFinite(parsed)?easternTime.format(parsed):'Time unavailable';
};
const odds=(value:number)=>(value>0?'+':'')+value;
const breakEven=(value:number)=>(100*(value<0?-value/(-value+100):100/(value+100))).toFixed(1)+'%';
const age=(milliseconds:number)=>milliseconds<60000?'under 1 minute':(milliseconds/60000).toFixed(1)+' minutes';
const count=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:undefined;
const object=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const failureLabels:Record<ProviderFailureKind,string>={
 CONFIGURATION:'Provider configuration unavailable',DEADLINE:'Request budget reached',TIMEOUT:'Request timed out',
 NETWORK:'Network request failed',HTTP:'Provider HTTP error',AUTH:'Provider authorization failed',RATE_LIMITED:'Provider rate limit reached',
 QUOTA_EXHAUSTED:'Provider quota exhausted',REDIRECT_BLOCKED:'Provider redirect blocked',INVALID_JSON:'Provider response could not be decoded',
 INVALID_PAYLOAD:'Provider response failed validation',BODY_READ_FAILED:'Provider response body could not be read',BODY_TOO_LARGE:'Provider response exceeded the size limit',
 QUOTA_UNVERIFIED:'Remaining provider credits are unverified',CREDIT_RESERVE:'Configured credit reserve protected',CREDIT_PAUSED:'Paid odds requests are paused',NO_MARKETS:'No odds markets returned',CACHE_STALE:'Cached provider result expired'
};

export function providerDiagnosticSummary(diagnostics:ProviderDiagnostics|undefined,now:number):string[]{
 if(!diagnostics||diagnostics.schemaVersion!==1)return [];
 const requests=Array.isArray(diagnostics.requests)?diagnostics.requests.filter(request=>request&&typeof request==='object'):[];
 const lines:string[]=[];
 if(diagnostics.failureKind&&failureLabels[diagnostics.failureKind])lines.push(failureLabels[diagnostics.failureKind]);
 if(diagnostics.cacheHit)lines.push('Cached provider result');
 const preflight=requests.find(request=>request.stage==='PREFLIGHT'),last=requests.at(-1);
 const stages=[...new Set([preflight,last].filter((request):request is ProviderRequestDiagnostic=>Boolean(request)))];
 for(const request of stages){
  const stage=request.stage==='PREFLIGHT'?(request.endpoint==='SPORTS_CATALOG'?'Free quota preflight':'Provider preflight'):request.stage==='BOOTSTRAP'?'Initial odds request':
   request.stage==='FALLBACK'?'Fallback odds request':'Additional sport request';
  const http=count(request.httpStatus);
  const result=request.responseReceived===true?(http!==undefined&&http>=100&&http<=599?`HTTP ${http}`:'HTTP response received'):
   request.attempted===true?'No HTTP response received':'Request not started';
  const phase=request.failurePhase==='RESPONSE_BODY'?'response body':request.failurePhase==='VALIDATION'?'response validation':
   request.failurePhase==='BUDGET'?'request budget':request.failurePhase==='REQUEST'?'request stage':undefined;
  lines.push(`${stage}: ${result}${phase?` · ${phase}`:''}`);
 }
 const quotaTime=timestamp(diagnostics.quotaObservedAt);
 const quotaRequest=[...requests].reverse().find(request=>request.responseReceived===true&&
  count(request.quota?.remaining)!==undefined&&timestamp(request.observedAt)===quotaTime);
 const quotaKnown=(diagnostics.quotaEvidence==='CURRENT_RESPONSE'||diagnostics.quotaEvidence==='CACHED_RESPONSE')&&
  Number.isFinite(quotaTime)&&quotaTime<=now&&quotaRequest;
 lines.push(quotaKnown?`Quota evidence: ${diagnostics.quotaEvidence==='CACHED_RESPONSE'?'cached':'latest'} provider response · ${quotaKnown.quota.remaining} credits remaining · ${time(diagnostics.quotaObservedAt)} · ${age(now-quotaTime)} ago`:
  'Quota evidence unavailable; remaining credits are unverified');
 return lines;
}

export function acceptsLiveBoardResponse(value:unknown,status:number):boolean{
 const body=object(value),history=object(body.history),predictions=object(body.predictions),core=object(body.coreStatus);
 const shape=typeof body.generatedAt==='string'&&Number.isFinite(timestamp(body.generatedAt))&&
  typeof body.source==='string'&&Array.isArray(body.rows)&&Array.isArray(body.sports)&&
  Array.isArray(body.historicalBets)&&Array.isArray(body.anomalies)&&Array.isArray(predictions.contracts)&&
  Array.isArray(history.sports)&&Array.isArray(history.legCounts)&&Array.isArray(history.markets)&&Object.keys(object(history.overall)).length>0;
 if(!shape)return false;
 if(body.coreStatus!==undefined&&(typeof core.ok!=='boolean'||!['READY','NO_ELIGIBLE_MARKETS','CORE_TIMEOUT','CORE_FAILED'].includes(String(core.code))))return false;
 if(status>=200&&status<300)return true;
 return status===503&&body.schema==='edgeforce-live-board-v199'&&core.ok===false&&
  ['NO_ELIGIBLE_MARKETS','CORE_TIMEOUT','CORE_FAILED'].includes(String(core.code))&&
  (body.rows as unknown[]).length===0&&(body.sports as unknown[]).length===0;
}

export function hasCurrentBoardSnapshot(generatedAt:unknown,now:number,failed=false,coreStatus?:LiveBoardCoreStatus):boolean{
 const generated=timestamp(generatedAt);
 const coreAvailable=coreStatus===undefined||coreStatus.ok===true&&coreStatus.code==='READY';
 return !failed&&coreAvailable&&Number.isFinite(now)&&Number.isFinite(generated)&&generated<=now&&now-generated<=120000;
}

export function currentBoardRows<T extends ResearchRow>(rows:T[],generatedAt:string,now:number,failed=false,coreStatus?:LiveBoardCoreStatus):T[]{
 if(!hasCurrentBoardSnapshot(generatedAt,now,failed,coreStatus))return [];
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
 let expiredCount=0,startedCount=0,unverifiedCount=0;
 const current=supplied.filter(row=>{
  const observed=timestamp(row?.quoteObservedAt),start=timestamp(row?.startTime);
  if(row?.evidenceClass!=='OBSERVED_REFERENCE'||!isPulseAmericanPrice(row.odds)||!Number.isSafeInteger(row.odds)||
   !Number.isFinite(now)||!Number.isFinite(observed)||observed>now||!Number.isFinite(start)){unverifiedCount++;return false}
  if(start<=now){startedCount++;return false}
  if(now-observed>observationLimit){expiredCount++;return false}
  return true;
 });
 const sportRows=filters.sport?current.filter(row=>row.sport===filters.sport):current;
 const matching=filters.market?sportRows.filter(row=>row.market===filters.market):sportRows;
 const suppliedSportRows=filters.sport?supplied.filter(row=>row?.sport===filters.sport):supplied;
 const matchingSupplied=filters.market?suppliedSportRows.filter(row=>row?.market===filters.market):suppliedSportRows;
 const coverage=observedOdds?.coverageDetails;
 const reportedSports=Array.isArray(coverage?.sports)?coverage.sports:[];
 const sports=[...new Set([...supplied.map(row=>row?.sport),...reportedSports.map(row=>row.sport),filters.sport]
  .filter((value):value is string=>typeof value==='string'&&value.trim().length>0))].sort();
 const markets=[...new Set([...suppliedSportRows.map(row=>row?.market),filters.market]
  .filter((value):value is string=>typeof value==='string'&&value.trim().length>0))].sort();
 const sportCoverage=sports.map(sport=>{
  const suppliedRows=supplied.filter(row=>row?.sport===sport),reported=reportedSports.find(row=>row.sport===sport);
  return {sport,currentQuoteCount:current.filter(row=>row.sport===sport).length,receivedQuoteCount:suppliedRows.length,
   eligibleQuoteCount:count(reported?.eligibleQuoteCount),returnedQuoteCount:count(reported?.returnedQuoteCount),
   eligibleEventCount:count(reported?.eligibleEventCount),returnedEventCount:count(reported?.returnedEventCount)};
 });
 const limit=typeof filters.limit==='number'&&Number.isFinite(filters.limit)?Math.max(25,Math.floor(filters.limit)):25;
 return {current,sports,markets,sportCoverage,suppliedCount:supplied.length,expiredCount,startedCount,unverifiedCount,
  matchingSuppliedCount:matchingSupplied.length,matchingCount:matching.length,quotes:matching.slice(0,limit)};
}

const priceReviewStatus:Record<PriceReview['status'], string>={
 NO_APPROVED_FEEDS:'No approved sportsbook feeds are configured.',
 APPROVED_FEEDS_UNAVAILABLE:'The approved sportsbook feeds did not respond successfully.',
 NO_ELIGIBLE_MARKETS:'The responding feeds supplied no complete, current book markets.',
 NO_INDEPENDENT_MATCH:'No complete market matched across independently sourced sportsbooks.',
 CORROBORATED:'Matching sportsbook prices are available for review.'
};

function SportsbookPriceReview({review,now}:{review:PriceReview|null;now:number}){
 if(!review)return <p className="historyNote">Independent sportsbook price review is temporarily unavailable.</p>;
 const markets=review.markets.filter(market=>timestamp(market.expiresAt)>now);
 const expired=review.markets.length-markets.length;
 return <details className="historyBox" open>
  <summary>Independent sportsbook price review · {markets.length} current markets shown</summary>
  <p className="historyNote" role="status">{review.status==='CORROBORATED'&&!markets.length
   ?'The returned matched prices have expired.' : priceReviewStatus[review.status]}</p>
  <p className="historyNote">{review.respondedFeeds} of {review.approvedFeeds} approved feeds responded.
   {' '}{review.eligibleBookMarkets} complete book markets and {review.corroboratedMarkets} matching markets in this snapshot.
   {review.omittedMarkets>0&&` ${review.omittedMarkets} omitted by the display limit.`}
   {expired>0&&` ${expired} returned markets have expired.`}
   {review.inputTruncated&&' A feed exceeded the input limit and was withheld.'}</p>
  {markets.length>0&&<>
   <p className="historyNote">Matched prices are for pregame review. Model probability, expected value and stakes require separate evidence.</p>
   <div className="tableWrap"><table aria-label="Independently corroborated sportsbook prices">
    <thead><tr><th scope="col">Event · Eastern</th><th scope="col">Market</th><th scope="col">Book / price</th><th scope="col">Book update · Eastern</th></tr></thead>
    <tbody>{markets.flatMap(market=>market.sources.map(source=><tr key={JSON.stringify([market.id,source.providerId,source.bookmaker])}>
     <td>{market.away} at {market.home}<small>{market.league} · {time(market.startTime)}</small></td>
     <td>{market.market}{market.line!==null&&` ${market.line}`}<small>{market.settlementKey}</small></td>
     <td>{source.bookmaker}{source.quotes.map(quote=><small key={quote.selection}>{quote.selection} · {odds(quote.americanOdds)}</small>)}</td>
     <td>{time(source.sourceUpdatedAt)}<small>{source.providerId} · {source.sourceEventId}</small></td>
    </tr>))}</tbody>
   </table></div>
  </>}
  {Object.keys(review.rejections).length>0&&<details className="historyBox">
   <summary>Why prices were withheld</summary>
   {Object.entries(review.rejections).map(([reason,total])=><div className="historyRow" key={reason}>
    <span>{reason.toLowerCase().replaceAll('_',' ')}</span><b>{total}</b>
   </div>)}
  </details>}
 </details>;
}

export default function ObservedOddsPanel({observedOdds,pulse,providerAttempts=[],priceReview,coreStatus,collection,now,stale,loading}:Props){
 const [sport,setSport]=useState(''),[market,setMarket]=useState(''),[visibleCount,setVisibleCount]=useState(25);
 const {current,sports,markets,sportCoverage,suppliedCount,expiredCount,startedCount,unverifiedCount,matchingSuppliedCount,matchingCount,quotes}=referenceOddsView(observedOdds,now,{sport,market,limit:visibleCount});
 const pulseEvidence=evaluatePulseEvidence(pulse,now);
 const pulsePrices=pulseEvidence.rows.flatMap(row=>row.prices.map(price=>({...row,price}))).slice(0,25);
 const attempts=providerAttempts;
 const coverage=observedOdds?.coverageDetails;
 const eligibleCount=count(coverage?.eligibleQuoteCount),returnedCount=count(coverage?.returnedQuoteCount),omittedCount=count(coverage?.omittedQuoteCount);
 const collectionSources=Array.isArray(collection?.sources)?collection.sources:[];
 return <section className="v21Panel" id="observed-odds" aria-label="Observed sportsbook prices">
  <div className="v21PanelHead">
   <div><div className="eyebrow">OBSERVED SPORTSBOOK PRICES</div><h3>Reference odds and current price observations</h3></div>
   <div className="panelMeta"><span>{loading?'Loading observations':stale?'Last snapshot · refresh unavailable':'Partial source coverage'}</span></div>
  </div>
  <div className="v21Stats">
   <div><small>CURRENT REFERENCE PRICES</small><strong>{loading?'—':current.length}</strong><span>{loading?'Awaiting the first response':`${suppliedCount} returned in this snapshot · upcoming observations within five minutes`}</span></div>
   <div><small>OPEN PULSE PRICES</small><strong>{loading?'—':pulseEvidence.priceCount}</strong><span>Snapshot and market updates within two minutes</span></div>
   <div><small>PRICE MEASURE</small><strong>Break-even</strong><span>Calculated from the quoted price only</span></div>
   <div><small>RECOMMENDATION STATUS</small><strong>Observation only</strong><span>Independent forecasts and value are not established here</span></div>
  </div>
  {stale&&<p className="v21Alert" role="status">The latest observation response failed or expired. Retained observations show their original times; current recommendation controls are unavailable.</p>}
  {coreStatus&&!coreStatus.ok&&<p className="v21Alert" role="status">
   {coreStatus.code==='NO_ELIGIBLE_MARKETS'?'No eligible model markets were returned.':'The model board is unavailable.'} Current observations remain available for reference; model action controls are unavailable.
   {coreStatus.error&&<small> {coreStatus.error}</small>}
  </p>}
  {priceReview!==undefined&&<SportsbookPriceReview review={priceReview} now={now}/>}
  <p className="historyNote">Reference prices are observations from the named source. An observation time records when the feed was read; it does not establish when the bookmaker last changed the price. All times below use Eastern Time.</p>
  {!loading&&<div className="historyNote">
   <div>{current.length} current of {suppliedCount} returned quotes. {expiredCount} expired; {startedCount} removed after the event start; {unverifiedCount} unverified.</div>
   {eligibleCount!==undefined&&returnedCount!==undefined&&omittedCount!==undefined
    ?<div>{returnedCount} of {eligibleCount} eligible collected quotes returned. {omittedCount>0?`${omittedCount} omitted by the response limit.`:'No quotes omitted by this response limit.'}</div>
    :<div>Collection and response-limit counts were not supplied.</div>}
   {coverage?.upstreamTruncated&&<div>Earlier source snapshots were truncated; the exact number omitted before this response is unknown.</div>}
   <div>These counts describe collected source observations. Full league and bookmaker coverage remains unverified.</div>
  </div>}
  {sportCoverage.length>0&&<details className="historyBox" open>
   <summary>Supplied coverage by sport</summary>
   <div className="tableWrap"><table aria-label="Reference odds coverage by sport">
    <thead><tr><th scope="col">Sport</th><th scope="col">Current quotes</th><th scope="col">Returned quotes</th><th scope="col">Eligible collected quotes</th><th scope="col">Source events returned / collected</th></tr></thead>
    <tbody>{sportCoverage.map(row=><tr key={row.sport}>
     <td>{row.sport}</td><td>{row.currentQuoteCount}</td><td>{row.receivedQuoteCount}</td><td>{row.eligibleQuoteCount??'—'}</td>
     <td>{row.returnedEventCount??'—'} / {row.eligibleEventCount??'—'}</td>
    </tr>)}</tbody>
   </table></div>
  </details>}
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
  {!quotes.length&&<p className="historyNote">{loading?'Loading source observations…':matchingSuppliedCount?'No returned quote matching these filters is current. Check the expiry and event-start counts above.':current.length?'No returned reference prices match these filters.':'No current reference prices are available in this response.'}</p>}
  {quotes.length>0&&<div className="historyNote">Showing {quotes.length} of {matchingCount} matching current reference observations in this partial snapshot.
   <div>{matchingSuppliedCount} returned quotes match the selected sport and market.</div>
   {matchingCount>quotes.length&&<div><button type="button" className="ackBtn" onClick={()=>setVisibleCount(count=>Math.min(matchingCount,count+25))}>Show more ({Math.min(25,matchingCount-quotes.length)})</button></div>}
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
  {collection&&<details className="historyBox" open={collection.partial}>
   <summary>Source collection · {collection.partial?'partial response':'attempts reported'}{collection.deadlineReached?' · response deadline reached':''}</summary>
   <p className="historyNote">Acquisition status describes the configured source attempts. Cached or completed attempts do not establish complete odds coverage; quote timestamps above determine which observations remain current.</p>
   {collectionSources.map(source=><div className="historyRow" key={source.id}>
    <span>{source.label} · {source.id}</span><b>{source.status}</b>
    <small>{source.gameCount} source events · {source.referenceCount} reference quotes in the collected source result
     {Number.isFinite(timestamp(source.observedAt))&&timestamp(source.observedAt)<=now?` · Observed ${time(source.observedAt)} · ${age(now-timestamp(source.observedAt))} ago`:' · Source observation time unavailable'}
     {source.error?` · ${source.error}`:''}</small>
   </div>)}
   {!collectionSources.length&&<p className="historyNote">No individual source-attempt results were supplied.</p>}
  </details>}
  <details className="historyBox" open={current.length===0&&attempts.some(attempt=>!attempt.ok)}>
   <summary>Provider response details</summary>
   {attempts.map((attempt,index)=><div className="historyRow" key={`${attempt.providerId}:${index}`}>
    <span>{attempt.providerId}</span><b>{typeof attempt.observedReferenceMarkets==='number'&&Number.isFinite(attempt.observedReferenceMarkets)&&attempt.observedReferenceMarkets>0?'Reference only':attempt.skipped?'Paused':attempt.ok?'Response accepted':'Unavailable'}</b>
    <small>{attempt.error||'No failure reported'}{attempt.circuitState?` · Circuit ${attempt.circuitState}`:''}</small>
    {providerDiagnosticSummary(attempt.diagnostics,now).map((line,index)=><small key={index}>{line}</small>)}
   </div>)}
   {!attempts.length&&<p className="historyNote">No provider-attempt details were returned with this snapshot.</p>}
   <p className="historyNote">Details reflect this response. Rechecking the page does not restore exhausted provider credits. Reference prices and pulse observations do not establish an executable offer or independent model advantage.</p>
  </details>
 </section>;
}
