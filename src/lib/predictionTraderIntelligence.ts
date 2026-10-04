import type {PredictionTrade} from './predictionFlow';

export type PolymarketLeaderboardRow={
 rank:number;
 traderId:string;
 name?:string;
 pnl:number;
 volume:number;
 verified?:boolean;
 profileImage?:string;
 xUsername?:string;
};

export type PolymarketUserStats={
 traderId:string;
 markets:number;
 biggestWin:number;
 allTimePnl:number;
 joinDate?:string;
};

type CacheEntry<T>={at:number;value:T};
const leaderboardCache=new Map<string,CacheEntry<PolymarketLeaderboardRow[]>>();
const userStatsCache=new Map<string,CacheEntry<PolymarketUserStats|null>>();
const CACHE_MS=5*60*1000;

const obj=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const arr=(value:unknown):unknown[]=>Array.isArray(value)?value:[];
const asNum=(value:unknown,fallback=0)=>{
 const n=Number(value);
 return Number.isFinite(n)?n:fallback;
};
const asStr=(value:unknown,fallback='')=>typeof value==='string'?value:fallback;

async function fetchJson(url:string,timeoutMs=8000){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const res=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store',signal:controller.signal});
  if(!res.ok)return {ok:false as const,data:null,error:`HTTP ${res.status}`};
  return {ok:true as const,data:await res.json() as unknown,error:undefined};
 }catch(error){
  return {ok:false as const,data:null,error:error instanceof Error?error.message:'request failed'};
 }finally{
  clearTimeout(timer);
 }
}

export async function fetchPolymarketLeaderboard(
 timePeriod:'day'|'week'|'month'|'all'='week',
 limit=100,
 category='overall'
){
 const cacheKey=[timePeriod,category,limit].join('|');
 const cached=leaderboardCache.get(cacheKey);
 if(cached&&Date.now()-cached.at<CACHE_MS)return {ok:true,rows:cached.value,cached:true as const};

 const base=String(process.env.POLYMARKET_DATA_V2_URL||'https://data-api.polymarket.com/v2').replace(/\/$/,'');
 const url=new URL(base+'/leaderboard');
 url.searchParams.set('time_period',timePeriod);
 url.searchParams.set('sort_by','PNL');
 url.searchParams.set('category',category);
 url.searchParams.set('limit',String(Math.max(1,Math.min(500,limit))));

 const result=await fetchJson(url.toString(),Math.max(3000,Number(process.env.POLYMARKET_TIMEOUT_MS||8000)));
 if(!result.ok)return {ok:false,rows:[] as PolymarketLeaderboardRow[],error:result.error,cached:false as const};
 const root=obj(result.data);
 const rows:PolymarketLeaderboardRow[]=[];
 for(const [index,value] of arr(root.data).entries()){
  const row=obj(value);
  const traderId=asStr(row.user_id,asStr(row.user,asStr(row.proxy_wallet,'')));
  if(!traderId)continue;
  const item:PolymarketLeaderboardRow={
   rank:Math.max(1,Math.round(asNum(row.rank,index+1))),
   traderId,
   pnl:asNum(row.pnl,asNum(row.profit,0)),
   volume:asNum(row.volume,asNum(row.volume_usdc,0)),
   verified:Boolean(row.verified)
  };
  const name=asStr(row.user_name,asStr(row.name,''));
  const profileImage=asStr(row.profile_image,'');
  const xUsername=asStr(row.x_username,'');
  if(name)item.name=name;
  if(profileImage)item.profileImage=profileImage;
  if(xUsername)item.xUsername=xUsername;
  rows.push(item);
 }

 leaderboardCache.set(cacheKey,{at:Date.now(),value:rows});
 return {ok:true,rows,cached:false as const};
}

export async function fetchPolymarketUserStats(traderId:string){
 const key=traderId.toLowerCase();
 const cached=userStatsCache.get(key);
 if(cached&&Date.now()-cached.at<CACHE_MS)return {ok:true,profile:cached.value,cached:true as const};

 const base=String(process.env.POLYMARKET_DATA_V2_URL||'https://data-api.polymarket.com/v2').replace(/\/$/,'');
 const url=new URL(base+'/user-stats');
 url.searchParams.set('user',traderId);
 const result=await fetchJson(url.toString(),Math.max(3000,Number(process.env.POLYMARKET_TIMEOUT_MS||8000)));
 if(!result.ok)return {ok:false,profile:null,error:result.error,cached:false as const};

 const root=obj(result.data);
 const row=obj(root.data);
 if(!Object.keys(row).length){
  userStatsCache.set(key,{at:Date.now(),value:null});
  return {ok:true,profile:null,cached:false as const};
 }

 const joinEpoch=asNum(row.join_date,0);
 const profile:PolymarketUserStats={
  traderId,
  markets:Math.max(0,Math.round(asNum(row.trades,0))),
  biggestWin:asNum(row.biggest_win,0),
  allTimePnl:asNum(row.all_time_pnl,0),
  joinDate:joinEpoch>0?new Date(joinEpoch*1000).toISOString():undefined
 };
 userStatsCache.set(key,{at:Date.now(),value:profile});
 return {ok:true,profile,cached:false as const};
}

function median(values:number[]){
 if(!values.length)return 0;
 const sorted=[...values].sort((a,b)=>a-b);
 const mid=Math.floor(sorted.length/2);
 return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
}

export function buildTraderSignals(
 trades:PredictionTrade[],
 leaderboard:PolymarketLeaderboardRow[],
 limit=30
){
 const rankMap=new Map(leaderboard.map(x=>[x.traderId.toLowerCase(),x]));
 const poly=trades.filter(x=>x.venue==='Polymarket'&&x.traderId&&x.notional>0);
 const byTrader=new Map<string,PredictionTrade[]>();
 for(const trade of poly){
  const key=trade.traderId!.toLowerCase();
  byTrader.set(key,[...(byTrader.get(key)||[]),trade]);
 }

 const marketMedian=Math.max(1,median(poly.map(x=>x.notional)));
 const signals=[...byTrader.entries()].map(([key,rows])=>{
  const latest=[...rows].sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime())[0];
  const notional=rows.reduce((s,x)=>s+x.notional,0);
  const average=notional/Math.max(1,rows.length);
  const maxTrade=Math.max(...rows.map(x=>x.notional));
  const leader=rankMap.get(key);
  const pnlScore=leader?Math.max(0,Math.min(1,.5+Math.sign(leader.pnl)*Math.log10(1+Math.abs(leader.pnl))/12)):.45;
  const rankScore=leader?Math.max(.05,1-Math.min(500,leader.rank)/500):.35;
  const sizeScore=Math.max(0,Math.min(1,Math.log10(1+maxTrade/marketMedian)/2));
  const activityScore=Math.max(0,Math.min(1,rows.length/10));
  const smartScore=Math.max(0,Math.min(1,pnlScore*.40+rankScore*.25+sizeScore*.25+activityScore*.10));
  return {
   traderId:latest.traderId!,
   name:leader?.name,
   rank:leader?.rank,
   pnl:leader?.pnl,
   publicVolume:leader?.volume,
   verified:leader?.verified,
   recentTrades:rows.length,
   recentNotional:notional,
   averageTradeNotional:average,
   maxTradeNotional:maxTrade,
   convictionMultiple:maxTrade/marketMedian,
   smartScore,
   latestTrade:{
    marketId:latest.marketId,
    title:latest.title,
    direction:latest.direction,
    price:latest.price,
    notional:latest.notional,
    timestamp:latest.timestamp
   }
  };
 });

 return signals
  .sort((a,b)=>b.smartScore-a.smartScore||b.recentNotional-a.recentNotional)
  .slice(0,Math.max(1,limit));
}
