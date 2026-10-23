import {ingestOdds} from '@/lib/providers/ingest';
import type {Market} from '@/lib/types';
import {checkNetworkAuth} from '@/lib/firstPartySportsNetwork';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'};
const isFresh=(m:Market,now:number)=>Number.isFinite(m.sourceAgeMin)&&
 m.sourceAgeMin>=0&&m.sourceAgeMin<=15&&
 typeof m.sourceTimestamp==='string'&&Number.isFinite(Date.parse(m.sourceTimestamp))&&
 Date.parse(m.sourceTimestamp)<=now+60000&&
 (now-Date.parse(m.sourceTimestamp))/60000>=-1&&
 (now-Date.parse(m.sourceTimestamp))/60000<=15&&
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
  if(forceLive){
   const hash=process.env.EDGEFORCE_NETWORK_TOKEN_SHA256;
   if(!hash)return Response.json({ok:false,error:'OWNER_REFRESH_NOT_CONFIGURED'},
    {status:503,headers});
   if(!checkNetworkAuth(request.headers.get('authorization'),hash))
    return Response.json({ok:false,error:'OWNER_AUTH_REQUIRED_FOR_METERED_REFRESH'},
     {status:401,headers});
  }
  const result=await ingestOdds({forceLive,persist:!forceLive});
  const now=Date.now();
  const input=result.source==='demo'?[]:result.panelMarkets||[];
  const quoteDiagnostics={received:input.length,missingTimestamp:0,invalidTimestamp:0,staleTimestamp:0,invalidAmericanOdds:0,startedOrInvalidEvent:0,missingBookmaker:0};
  for(const m of input){
   const stamp=typeof m.sourceTimestamp==='string'?Date.parse(m.sourceTimestamp):Number.NaN;
   if(typeof m.sourceTimestamp!=='string'||!m.sourceTimestamp)quoteDiagnostics.missingTimestamp++;
   else if(!Number.isFinite(stamp)||stamp>now+60000)quoteDiagnostics.invalidTimestamp++;
   else if((now-stamp)/60000>15)quoteDiagnostics.staleTimestamp++;
   if(!Number.isSafeInteger(m.odds)||Math.abs(m.odds)<100||Math.abs(m.odds)>100000)quoteDiagnostics.invalidAmericanOdds++;
   if(!Number.isFinite(Date.parse(m.startTime))||Date.parse(m.startTime)<=now)quoteDiagnostics.startedOrInvalidEvent++;
   if(!m.sourceBook?.trim())quoteDiagnostics.missingBookmaker++;
  }
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
   targetBook:result.targetBook,degraded:result.degraded,rawCount:result.rawCount,
   quality:result.quality,providerPanel:result.providerPanel,
   markets:result.markets,
   sportsbookQuotes:quotes,
   sportsbookQuoteCount:quotes.length,
   quoteDiagnostics,
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
