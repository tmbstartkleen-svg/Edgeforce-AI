import {latestStoredMarkets} from '@/lib/persistence';
import type {Market} from '@/lib/types';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'};
/**
 * Read-only sportsbook odds view. Never triggers provider API requests or odds
 * writes. Uses only existing persisted snapshots. Market snapshots do not
 * establish executable prices, storage rights, source authenticity, or EV.
 */
export async function GET(){
 try{
  const stored=await latestStoredMarkets(500);
  const now=Date.now();
  const rows=stored.filter((m:Market)=>{
   const age=Number(m.sourceAgeMin);
   return Number.isFinite(age)&&age>=0&&age<=15&&
    Number.isFinite(Date.parse(m.startTime))&&Date.parse(m.startTime)>now&&
    Number.isSafeInteger(m.odds)&&Math.abs(m.odds)>=100&&Math.abs(m.odds)<=100000&&
    !!m.sourceBook?.trim()&&!/^(demo|simulation|synthetic|mock)$/i.test(m.sourceBook.trim());
  }).slice(0,100).map(m=>({
   sport:m.sport,league:m.league,event:m.event,selection:m.selection,
   market:m.market,odds:m.odds,sourceBook:m.sourceBook,
   sourceProviderId:m.sourceProviderId||'UNKNOWN',
   eventId:m.sourceEventId||m.id,startTime:m.startTime,
   sourceAgeMin:m.sourceAgeMin,sourceTimestamp:m.sourceTimestamp||null,
   quoteProvenance:'PERSISTED_SNAPSHOT_UNVERIFIED' as const
  }));
  const dk=rows.filter(m=>m.sourceBook?.trim().toLowerCase()==='draftkings');
  return Response.json({ok:true,mode:'STORED_SPORTSBOOK_QUOTES_READ_ONLY',
   asOf:new Date(now).toISOString(),source:'stored',providerRequests:0,writesPerformed:0,
   totalFreshQuotes:rows.length,draftKingsQuotes:dk.length,
   otherBookQuotes:rows.length-dk.length,hasVerifiedLiveQuotes:false,
   eligibleForAutomatedBetAlerts:false,rows,
   warning:'These are cached sportsbook snapshots, NOT verified executable DraftKings prices or independent win-probability edges. Source rights and refresh authenticity are not certified.'},{headers});
 }catch{
  return Response.json({ok:false,error:'STORED_ODDS_READ_UNAVAILABLE',rows:[],
   providerRequests:0,writesPerformed:0},{status:503,headers});
 }
}
