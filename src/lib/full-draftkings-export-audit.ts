/**
 * Stage 3 exhaustive, bounded, read-only DraftKings catalog observation pass.
 * Unlike the 25-row D1 write preflight, checks EVERY valid priced market
 * outcome in an authorized bulk event export. No API call, D1 write or claims
 * of provider entitlements; no market coverage without an expected catalog.
 */
import {auditDraftKingsMarketCoverage,type RequiredMarket,type ObservedMarket} from './draftkings-market-gap-audit';
type R=Record<string,unknown>;
const obj=(x:unknown):x is R=>!!x&&typeof x==='object'&&!Array.isArray(x);
const str=(x:unknown)=>typeof x==='string'&&x.trim().length>0;
const time=(x:unknown)=>typeof x==='string'?Date.parse(x):NaN;
const err=(rejected:Record<string,number>,k:string)=>{rejected[k]=(rejected[k]||0)+1};
const core=new Set(['h2h','spreads','totals']);
export function auditFullDraftKingsOddsExport(events:unknown,expected:RequiredMarket[],now=Date.now()){
 if(!Array.isArray(events)||events.length>500||!Array.isArray(expected)||expected.length>5000||
    !Number.isFinite(now))throw Error('INVALID_FULL_CATALOG_EXPORT');
 const observed:ObservedMarket[]=[];
 const rejected:Record<string,number>={};
 const unseenMarkets=new Map<string,number>();
 let eventCount=0,pricedOutcomesExamined=0,observedPlayerProps=0,capHit=false;
 for(const raw of events){
  if(!obj(raw)||!str(raw.id)||!str(raw.sport_key)||!Number.isFinite(time(raw.commence_time))||
   time(raw.commence_time)<=now){err(rejected,'INVALID_OR_STARTED_EVENT');continue}
  eventCount++;
  const books=Array.isArray(raw.bookmakers)?raw.bookmakers:[];
  if(books.length>100){err(rejected,'BOOKMAKER_LIMIT');continue}
  for(const b of books){
   if(!obj(b)||!str(b.key)){err(rejected,'INVALID_BOOKMAKER');continue}
   if(String(b.key).trim().toLowerCase()!=='draftkings')continue;
   const markets=Array.isArray(b.markets)?b.markets:[];
   if(markets.length>250){err(rejected,'MARKET_LIMIT');continue}
   for(const m of markets){
    if(!obj(m)||!str(m.key)){err(rejected,'INVALID_MARKET');continue}
    const marketType=m.key as string;
    if(!core.has(marketType)&&!/^player_[a-z0-9_]+$/.test(marketType)){
     if(unseenMarkets.size<200||unseenMarkets.has(marketType))
      unseenMarkets.set(marketType,(unseenMarkets.get(marketType)||0)+1);
     err(rejected,'UNMAPPED_MARKET');continue;
    }
    const ts=m.last_update===undefined?b.last_update:m.last_update;
    if(!Number.isFinite(time(ts))||time(ts)>now||now-time(ts)>15*60*1000){
     err(rejected,'STALE_MARKET');continue;
    }
    const outcomes=Array.isArray(m.outcomes)?m.outcomes:[];
    if(outcomes.length>500){err(rejected,'OUTCOME_LIMIT');continue}
    for(const o of outcomes){
     pricedOutcomesExamined++;
     if(!obj(o)||!str(o.name)||!Number.isSafeInteger(o.price)||
      Math.abs(o.price as number)<100||Math.abs(o.price as number)>100000){
      err(rejected,'INVALID_PRICE');continue;
     }
     if(marketType!=='h2h'&&(typeof o.point!=='number'||!Number.isFinite(o.point))){
      err(rejected,'MISSING_LINE');continue;
     }
     const isProp=marketType.startsWith('player_');
     if(isProp){
      // API's description/name are not stable third-party athlete IDs.
      // Record a rejected provisional outcome, never call it verified.
      observedPlayerProps++;err(rejected,'PROP_PLAYER_ID_NOT_STABLE');continue;
     }
     if(observed.length>=50000){capHit=true;err(rejected,'OBSERVATION_CAP');continue}
     observed.push({sport:raw.sport_key as string,
      league:str(raw.sport_title)?raw.sport_title as string:raw.sport_key as string,
      marketType,eventId:raw.id as string,bookmaker:'DraftKings',
      sourceUpstreamId:'api.the-odds-api.com',observedAt:new Date(time(ts)).toISOString(),
      startsAt:raw.commence_time as string,outcomeId:o.name as string,
      americanOdds:o.price as number,
      ...(marketType!=='h2h'?{line:String(o.point)}:{})});
    }
   }
  }
 }
 const coverage=auditDraftKingsMarketCoverage(expected,observed,now);
 return {...coverage,mode:'FULL_EXPORT_DRAFTKINGS_CATALOG_AUDIT' as const,
  coverageComplete:coverage.coverageComplete&&!capHit,
  providerEventsExamined:events.length,validFutureEvents:eventCount,
  pricedOutcomesExamined,validCoreQuotes:observed.length,
  provisionalPlayerPropOutcomes:observedPlayerProps,
  quoteCapReached:capHit,unmappedMarkets:[...unseenMarkets].map(([marketType,count])=>({marketType,count})),
  providerRejections:rejected,independentlyVerifiedProvider:false,
  expectedCatalogAuthenticated:false,sourceEntitlementVerified:false,
  releaseCertified:false,
  warning:'Complete scan of supplied response only, NOT of all DraftKings network markets. Player descriptions lack stable IDs; provider rights and catalog authenticity remain unverified.'};
}
