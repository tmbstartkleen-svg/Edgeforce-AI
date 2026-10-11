import {createHash,timingSafeEqual} from 'node:crypto';

/**
 * V205 EdgeForce Sports Network - private, read-only observations API.
 * Owner-issued token is independent of vendor credentials and does NOT supply source data.
 */
export const networkHeaders={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const hex64=/^[a-f0-9]{64}$/i;
const clean=(v:string,size=100)=>typeof v==='string'?v.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,size):'';
export function checkNetworkAuth(bearer:string|null,storedHash:string|undefined){
 const expected=(storedHash||'').trim().toLowerCase();
 if(!hex64.test(expected)||!bearer?.startsWith('Bearer '))return false;
 const secret=bearer.slice(7);
 if(!hex64.test(secret))return false;
 const calculated=createHash('sha256').update(secret.toLowerCase()).digest();
 return timingSafeEqual(calculated,Buffer.from(expected,'hex'));
}
export function authorizeNetwork(request:Request){
 const hash=process.env.EDGEFORCE_NETWORK_TOKEN_SHA256;
 if(!hash||!hex64.test(hash.trim()))return Response.json({ok:false,status:'NETWORK_KEY_NOT_CONFIGURED'},
  {status:503,headers:networkHeaders});
 if(!checkNetworkAuth(request.headers.get('authorization'),hash))
  return Response.json({ok:false,status:'UNAUTHORIZED'},{status:401,headers:networkHeaders});
 return null;
}

export type RawNetworkMarket={
 eventId:string;sport:string;league:string;home:string;away:string;startTime:string|Date;
 market:string;selection:string;odds:number;bookmaker:string;provider:string;
 sourceTimestamp:string|null;pulledAt:string|Date;priorAgeMin:string|null;
};
export type NetworkMarket={
 eventId:string;sport:string;league:string;home:string;away:string;startTime:string;
 market:string;selection:string;odds:number;bookmaker:string;provider:string;
 sourceTimestamp:string|null;pulledAt:string;quoteAgeSeconds:number|null;
 freshness:'RECENT'|'STALE'|'UNVERIFIED';executable:false;
};
const timestamp=(v:string|Date|null):number|null=>{
 if(!v)return null;
 const n=new Date(v).getTime();
 return Number.isFinite(n)?n:null;
};
const marketKey=(q:NetworkMarket)=>[q.eventId,q.market,q.selection].join('|').toLowerCase();
export function normalizeNetworkMarkets(input:readonly RawNetworkMarket[],now=Date.now(),limit=60,sport=''){
 const quotes:NetworkMarket[]=[];
 let malformed=0,missingTimestamp=0;
 const seen=new Set<string>();
 for(const item of input){
  if(sport&&clean(item.sport).toLowerCase()!==sport.toLowerCase())continue;
  const start=timestamp(item.startTime),pulled=timestamp(item.pulledAt);
  const observed=timestamp(item.sourceTimestamp);
  const odds=Number(item.odds);
  if(!start||!pulled||start<=now||!Number.isSafeInteger(odds)||Math.abs(odds)<100||Math.abs(odds)>100000||
   !clean(item.bookmaker)||!clean(item.provider)||!clean(item.selection)||!clean(item.market)){
   malformed++;continue;
  }
  const rawPrior=item.priorAgeMin===null?null:Number(item.priorAgeMin);
  const age=observed===null||observed>now+60000||pulled>now+60000||
   (rawPrior!==null&&(!Number.isFinite(rawPrior)||rawPrior<0))?null:
   Math.max(0,(now-observed)/1000,(now-pulled)/1000,(rawPrior||0)*60);
  if(age===null)missingTimestamp++;
  const record:NetworkMarket={
   eventId:clean(item.eventId),sport:clean(item.sport,40),league:clean(item.league),
   home:clean(item.home),away:clean(item.away),startTime:new Date(start).toISOString(),
   market:clean(item.market),selection:clean(item.selection,120),odds,
   bookmaker:clean(item.bookmaker,50),provider:clean(item.provider,50),
   sourceTimestamp:observed===null?null:new Date(observed).toISOString(),
   pulledAt:new Date(pulled).toISOString(),quoteAgeSeconds:age,
   freshness:age===null?'UNVERIFIED':age<=120?'RECENT':'STALE',executable:false
  };
  const identity=marketKey(record)+'|'+record.bookmaker.toLowerCase()+'|'+record.provider.toLowerCase();
  if(seen.has(identity))continue;
  seen.add(identity);
  quotes.push(record);
 }
 const recent=quotes.filter(q=>q.freshness==='RECENT');
 const providerCount=new Set(recent.map(q=>q.provider.toLowerCase())).size;
 const bookmakerCount=new Set(recent.map(q=>q.bookmaker.toLowerCase())).size;
 const lineBooks=new Map<string,Set<string>>();
 for(const q of recent){
  const key=marketKey(q);
  const s=lineBooks.get(key)||new Set<string>();
  s.add(q.bookmaker.toLowerCase());lineBooks.set(key,s);
 }
 const safeLimit=Math.max(1,Math.min(100,Math.floor(limit)||60));
 return {
  role:'READ_ONLY_MARKET_OBSERVATIONS' as const,
  updatedAt:new Date(now).toISOString(),executionEligible:false,
  evidenceStatus:recent.length?'RECENT_STORED_OBSERVATIONS':'NO_RECENT_QUOTES',
  coverage:{
   examined:input.length,valid:quotes.length,recent:recent.length,missingTimestamp,malformed,
   distinctRecentProviders:providerCount,distinctRecentBookmakers:bookmakerCount,
   recentSelectionsWithTwoBooks:[...lineBooks.values()].filter(s=>s.size>=2).length
  },
  warning:'Stored third-party sportsbook observations only. A first-party API token or AI explanation cannot manufacture official data, independent bookmakers, or executable odds.',
  markets:quotes.slice(0,safeLimit)
 };
}
