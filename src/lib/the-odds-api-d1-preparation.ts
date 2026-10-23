/**
 * Pure The Odds API v4 -> pilot D1 odds-envelope mapper.
 * Does not fetch, register sources, or persist anything. Source entitlement
 * and explicit owner-approved write gates remain external prerequisites.
 */
const nonempty=(v:unknown)=>typeof v==='string'&&v.trim().length>0;
const validTime=(v:unknown)=>nonempty(v)&&Number.isFinite(Date.parse(v as string));
const allowed=new Set(['h2h','spreads','totals']);
type RecordLike=Record<string,unknown>;
const object=(v:unknown):v is RecordLike=>!!v&&typeof v==='object'&&!Array.isArray(v);
export type PreparedOddsObservation={
 provider:'the-odds-api';upstreamId:'api.the-odds-api.com';eventId:string;marketId:string;
 observedAt:number;kind:'odds';value:{
 bookmaker:string;sport:string;league:string;marketType:string;outcomeId:string;
 startsAt:string;priceAmerican:number;line?:string;playerId?:string;playerName?:string;playerIdentityStatus?:'UNVERIFIED_NAME_ONLY';
 };
};
export function prepareTheOddsApiD1Batch(events:unknown,now=Date.now(),maxRows=25,options:{enablePlayerProps?:boolean}={}){
 if(!Number.isFinite(now)||!Number.isSafeInteger(maxRows)||maxRows<1||maxRows>25)
  throw Error('INVALID_ODDS_PREPARATION_LIMIT');
 if(!Array.isArray(events)||events.length>500)throw Error('INVALID_ODDS_EVENT_BATCH');
 const rows:PreparedOddsObservation[]=[];
 const unmappedMarkets=new Map<string,number>();
 const observedBookmakers=new Set<string>();
 const rejected:Record<string,number>={};
 const reject=(reason:string)=>{rejected[reason]=(rejected[reason]||0)+1;};
 let examined=0,playerPropsMapped=0;
 for(const e of events){
  if(!object(e)||!nonempty(e.id)||!nonempty(e.sport_key)||!validTime(e.commence_time)||
    Date.parse(e.commence_time as string)<=now){reject('INVALID_EVENT');continue;}
  const startsAt=e.commence_time as string;
  const league=nonempty(e.sport_title)?e.sport_title as string:e.sport_key as string;
  const books=Array.isArray(e.bookmakers)?e.bookmakers:[];
  if(books.length>100){reject('BOOKMAKER_BATCH_LIMIT');continue;}
  for(const book of books){
   if(!object(book)||!nonempty(book.key)||!validTime(book.last_update)){reject('MISSING_BOOK_TIMESTAMP');continue;}
   const bookmakerObservedAt=Date.parse(book.last_update as string);
   observedBookmakers.add((book.key as string).trim().toLowerCase());
   const markets=Array.isArray(book.markets)?book.markets:[];
   if(markets.length>100){reject('MARKET_BATCH_LIMIT');continue;}
   for(const market of markets){
    const supportedPlayerProp=options.enablePlayerProps===true&&object(market)&&typeof market.key==='string'&&/^player_[a-z0-9_]+$/.test(market.key);
    if(!object(market)||!nonempty(market.key)||(!allowed.has(market.key as string)&&!supportedPlayerProp)){
     if(object(market)&&nonempty(market.key)){
      const key=market.key as string;
      if(unmappedMarkets.has(key)||unmappedMarkets.size<100)
       unmappedMarkets.set(key,(unmappedMarkets.get(key)||0)+1);
     }
     reject('MARKET_NOT_MAPPED');continue;
    }
    // The Odds API may update markets at different times within one bookmaker.
    // Require a valid market timestamp when supplied, never inherit a fresher
    // bookmaker-level timestamp for an explicitly stale or malformed market.
    if(market.last_update!==undefined&&!validTime(market.last_update)){
     reject('INVALID_MARKET_TIMESTAMP');continue;
    }
    const observedAt=market.last_update===undefined?bookmakerObservedAt:Date.parse(market.last_update as string);
    if(observedAt>now||now-observedAt>15*60*1000){
     reject('ODDS_QUOTE_TIMESTAMP_NOT_FRESH');continue;
    }
    const outcomes=Array.isArray(market.outcomes)?market.outcomes:[];
    if(outcomes.length>100){reject('OUTCOME_BATCH_LIMIT');continue;}
    for(const outcome of outcomes){
     examined++;
     if(!object(outcome)||!nonempty(outcome.name)||!Number.isInteger(outcome.price)||
       Math.abs(outcome.price as number)<100||Math.abs(outcome.price as number)>100000){
      reject('INVALID_PRICED_OUTCOME');continue;
     }
     if(market.key!=='h2h'&&(!Number.isFinite(outcome.point)||typeof outcome.point!=='number')){
      reject('LINE_REQUIRED');continue;
     }
     if(supportedPlayerProp&&(!nonempty(outcome.description)||!['over','under'].includes(String(outcome.name).trim().toLowerCase()))){
      reject('PLAYER_PROP_IDENTITY_REQUIRED');continue;
     }
     if(rows.length>=maxRows){reject('BATCH_CAP_REACHED');continue;}
     const marketType=market.key as string;
     if(supportedPlayerProp)playerPropsMapped++;
     rows.push({provider:'the-odds-api',upstreamId:'api.the-odds-api.com',
       eventId:e.id as string,marketId:marketType,observedAt,kind:'odds',
       value:{bookmaker:book.title&&nonempty(book.title)?book.title as string:book.key as string,
        sport:e.sport_key as string,league,marketType,outcomeId:outcome.name as string,
        startsAt,priceAmerican:outcome.price as number,
        ...(marketType!=='h2h'?{line:String(outcome.point)}:{}),
        ...(supportedPlayerProp?{playerId:'name:'+String(outcome.description).trim().toLowerCase().split(/\s+/).join(' '),playerName:String(outcome.description).trim(),playerIdentityStatus:'UNVERIFIED_NAME_ONLY' as const}: {})}});
    }
   }
  }
 }
 return {mode:'DRY_RUN_ONLY' as const,readyForAuthorizedIngest:false,rows,examined,
  prepared:rows.length,rejected,playerPropsMapped,
  observedBookmakers:[...observedBookmakers].sort(),
  unmappedMarketTypes:[...unmappedMarkets].map(([marketType,count])=>({marketType,count})).sort((a,b)=>b.count-a.count||a.marketType.localeCompare(b.marketType)),
  warning:options.enablePlayerProps===true?'Dry-run player prop identities derive from names and are NOT stable verified player IDs. No source entitlement, no certified coverage, no D1 writes.':'Core h2h/spreads/totals only; player prop mapping requires explicit dry-run opt-in. No source entitlement, no verified live data, no D1 writes.'};
}
