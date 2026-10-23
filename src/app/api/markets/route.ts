import {ingestOdds} from '@/lib/providers/ingest';
import type {Market} from '@/lib/types';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'};
const isFresh=(m:Market,now:number)=>Number.isFinite(m.sourceAgeMin)&&
 m.sourceAgeMin>=0&&m.sourceAgeMin<=15&&
 Number.isFinite(Date.parse(m.startTime))&&Date.parse(m.startTime)>now&&
 Number.isSafeInteger(m.odds)&&Math.abs(m.odds)>=100&&Math.abs(m.odds)<=100000;
/**
 * Existing live market route, used only by deliberate operator refresh in
 * sportsbook panel. Preserve exact provider/bookmaker quotes separately from
 * cross-book consensus markets: a synthesized consensus line must not be
 * presented as an executable DraftKings book price.
 */
export async function GET(request:Request){
 try{
  // Never bypass the provider refresh cache unless the operator requests it.
  // The existing provider adapter still enforces its own quota policy.
  const forceLive=new URL(request.url).searchParams.get('forceLive')==='1';
  const result=await ingestOdds({forceLive});
  const now=Date.now();
  const input=result.source==='demo'?[]:result.panelMarkets||[];
  const quotes=input.filter(m=>isFresh(m,now)&&Boolean(m.sourceBook?.trim()))
   .slice(0,250).map(m=>({
    sport:m.sport,league:m.league,event:m.event,selection:m.selection,
    market:m.market,odds:m.odds,sourceBook:m.sourceBook,
    sourceProviderId:m.sourceProviderId||result.providerId||'UNKNOWN',
    startTime:m.startTime,sourceAgeMin:m.sourceAgeMin,
    sourceTimestamp:m.sourceTimestamp||null,
    quoteProvenance:'UPSTREAM_NORMALIZED_UNVERIFIED' as const
   }));
  return Response.json({
   mode:result.mode,source:result.source,
   providerId:result.providerId,providerName:result.providerName,
   attempts:result.attempts,warnings:result.warnings,error:result.error,
   markets:result.markets,
   sportsbookQuotes:quotes,
   sportsbookQuoteCount:quotes.length,
   draftKingsQuoteCount:quotes.filter(q=>q.sourceBook?.trim().toLowerCase()==='draftkings').length,
   quoteScope:'PROVIDER_LABELED_RAW_QUOTES_NOT_CONSENSUS',
   independentModelVerified:false,executablePriceVerified:false,
   providerOwnershipVerified:false,
   warning:'Provider-labeled odds are research quotes only. They are not independently verified, executable, or certified positive EV.'
  },{headers});
 }catch{
  return Response.json({ok:false,error:'MARKET_PROVIDER_SCAN_UNAVAILABLE',
   markets:[],sportsbookQuotes:[],attempts:[]},{status:503,headers});
 }
}
