import type {PredictionContract} from './predictionMarkets';

export type PredictionVenue='Kalshi'|'Polymarket';

export type PredictionTrade={
 id:string;
 venue:PredictionVenue;
 marketId:string;
 title:string;
 outcome?:string;
 direction:'YES'|'NO'|'BUY'|'SELL'|'UNKNOWN';
 price:number;
 size:number;
 notional:number;
 signedYesFlow:number;
 timestamp:string;
 traderId?:string;
};

export type FlowWindow='1H'|'4H'|'12H'|'24H';

export type FlowSummary={
 key:string;
 venue:PredictionVenue|'CROSS_VENUE';
 marketId:string;
 title:string;
 window:FlowWindow;
 trades:number;
 uniqueTraders:number;
 grossNotional:number;
 netYesFlow:number;
 yesShare:number;
 lastTradeAt:string;
};

export type CrossVenueGap={
 kalshi:PredictionContract;
 polymarket:PredictionContract;
 similarity:number;
 probabilityGap:number;
 absoluteGap:number;
 lowerVenue:PredictionVenue;
 higherVenue:PredictionVenue;
 lowerProbability:number;
 higherProbability:number;
 matchQuality:'STRONG'|'HEURISTIC';
};

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const asNum=(value:unknown,fallback=0)=>{
 const n=Number(value);
 return Number.isFinite(n)?n:fallback;
};
const asStr=(value:unknown,fallback='')=>typeof value==='string'?value:fallback;
const obj=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};

function parseDollarProbability(value:unknown,fallback=0){
 const n=asNum(value,NaN);
 if(!Number.isFinite(n))return fallback;
 return clamp(n>1?n/100:n,.001,.999);
}

function parseUnixOrIso(value:unknown){
 if(typeof value==='number'&&Number.isFinite(value)){
  const ms=value>1e12?value:value*1000;
  return new Date(ms).toISOString();
 }
 if(typeof value==='string'&&value){
  const n=Number(value);
  if(Number.isFinite(n)&&/^\d+(\.\d+)?$/.test(value.trim())){
   const ms=n>1e12?n:n*1000;
   return new Date(ms).toISOString();
  }
  const d=new Date(value);
  if(!Number.isNaN(d.getTime()))return d.toISOString();
 }
 return new Date().toISOString();
}

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

export async function fetchKalshiTrades(limit=500):Promise<{ok:boolean;trades:PredictionTrade[];error?:string}>{
 const base=String(process.env.KALSHI_API_BASE_URL||'https://external-api.kalshi.com/trade-api/v2').replace(/\/$/,'');
 const url=new URL(base+'/markets/trades');
 url.searchParams.set('limit',String(Math.max(1,Math.min(1000,limit))));
 const result=await fetchJson(url.toString(),Math.max(3000,Number(process.env.KALSHI_TIMEOUT_MS||8000)));
 if(!result.ok)return {ok:false,trades:[],error:result.error};
 const root=obj(result.data);
 const rows=Array.isArray(result.data)?result.data:Array.isArray(root.trades)?root.trades:[];
 const trades=rows.map((value,index):PredictionTrade|null=>{
  const row=obj(value);
  const ticker=asStr(row.ticker,asStr(row.market_ticker,asStr(row.marketTicker,'')));
  if(!ticker)return null;
  const taker=asStr(row.taker_side,asStr(row.takerSide,'')).toLowerCase();
  const yes=parseDollarProbability(row.yes_price_dollars ?? row.yes_price ?? row.yesPriceDollars ?? row.yesPrice,.5);
  const no=parseDollarProbability(row.no_price_dollars ?? row.no_price ?? row.noPriceDollars ?? row.noPrice,1-yes);
  const size=Math.max(0,asNum(row.count_fp ?? row.count ?? row.size ?? row.quantity,0));
  const direction=taker==='yes'?'YES':taker==='no'?'NO':'UNKNOWN';
  const price=direction==='NO'?no:yes;
  const notional=size*price;
  const signedYesFlow=direction==='YES'?notional:direction==='NO'?-notional:0;
  const timestamp=parseUnixOrIso(row.created_time ?? row.createdTime ?? row.ts ?? row.timestamp);
  return {
   id:asStr(row.trade_id,asStr(row.tradeId,`kalshi-${ticker}-${timestamp}-${index}`)),
   venue:'Kalshi',
   marketId:ticker,
   title:ticker,
   direction,
   price,size,notional,signedYesFlow,timestamp
  };
 }).filter((x):x is PredictionTrade=>Boolean(x));
 return {ok:true,trades};
}

export async function fetchPolymarketTrades(limit=500):Promise<{ok:boolean;trades:PredictionTrade[];error?:string}>{
 const base=String(process.env.POLYMARKET_DATA_URL||'https://data-api.polymarket.com').replace(/\/$/,'');
 const url=new URL(base+'/trades');
 url.searchParams.set('limit',String(Math.max(1,Math.min(500,limit))));
 url.searchParams.set('takerOnly','true');
 const result=await fetchJson(url.toString(),Math.max(3000,Number(process.env.POLYMARKET_TIMEOUT_MS||8000)));
 if(!result.ok)return {ok:false,trades:[],error:result.error};
 const root=obj(result.data);
 const rows=Array.isArray(result.data)?result.data:Array.isArray(root.data)?root.data:[];
 const trades=rows.map((value,index):PredictionTrade|null=>{
  const row=obj(value);
  const marketId=asStr(row.conditionId,asStr(row.condition_id,asStr(row.market,'')));
  if(!marketId)return null;
  const outcome=asStr(row.outcome,'');
  const side=asStr(row.side,'').toUpperCase();
  const price=clamp(asNum(row.price,.5),.001,.999);
  const size=Math.max(0,asNum(row.size,0));
  const notional=size*price;
  const out=outcome.toLowerCase();
  const isYes=out==='yes'||out==='y'||out==='true';
  const isNo=out==='no'||out==='n'||out==='false';
  let signedYesFlow=0;
  if(isYes)signedYesFlow=side==='BUY'?notional:side==='SELL'?-notional:0;
  else if(isNo)signedYesFlow=side==='BUY'?-notional:side==='SELL'?notional:0;
  const direction:isYes extends true ? never : never = null as never;
  const label:PredictionTrade['direction']=isYes?(side==='BUY'?'YES':'NO'):isNo?(side==='BUY'?'NO':'YES'):(side==='BUY'?'BUY':side==='SELL'?'SELL':'UNKNOWN');
  const timestamp=parseUnixOrIso(row.timestamp ?? row.created_at ?? row.createdAt);
  return {
   id:asStr(row.transactionHash,asStr(row.id,`poly-${marketId}-${timestamp}-${index}`)),
   venue:'Polymarket',
   marketId,
   title:asStr(row.title,asStr(row.question,marketId)),
   outcome:outcome||undefined,
   direction:label,
   price,size,notional,signedYesFlow,timestamp,
   traderId:asStr(row.proxyWallet,asStr(row.user,''))||undefined
  };
 }).filter((x):x is PredictionTrade=>Boolean(x));
 return {ok:true,trades};
}

export function enrichKalshiTradeTitles(trades:PredictionTrade[],contracts:PredictionContract[]){
 const titles=new Map(
  contracts
   .filter(x=>x.source.toLowerCase()==='kalshi')
   .map(x=>[x.id.toLowerCase(),x.title] as const)
 );
 return trades.map(trade=>trade.venue==='Kalshi'
  ?{...trade,title:titles.get(trade.marketId.toLowerCase())||trade.title}
  :trade
 );
}

function windowMs(window:FlowWindow){
 if(window==='1H')return 60*60*1000;
 if(window==='4H')return 4*60*60*1000;
 if(window==='12H')return 12*60*60*1000;
 return 24*60*60*1000;
}

export function summarizeFlow(trades:PredictionTrade[],window:FlowWindow,now=Date.now()):FlowSummary[]{
 const cutoff=now-windowMs(window);
 const groups=new Map<string,PredictionTrade[]>();
 for(const trade of trades){
  const ts=new Date(trade.timestamp).getTime();
  if(!Number.isFinite(ts)||ts<cutoff)continue;
  const key=[trade.venue,trade.marketId].join('|');
  groups.set(key,[...(groups.get(key)||[]),trade]);
 }
 const out:FlowSummary[]=[];
 for(const [key,rows] of groups){
  const grossNotional=rows.reduce((s,x)=>s+x.notional,0);
  const netYesFlow=rows.reduce((s,x)=>s+x.signedYesFlow,0);
  const traderIds=new Set(rows.map(x=>x.traderId).filter(Boolean));
  const lastTradeAt=[...rows].sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime())[0]?.timestamp||new Date().toISOString();
  out.push({
   key,
   venue:rows[0].venue,
   marketId:rows[0].marketId,
   title:rows[0].title,
   window,
   trades:rows.length,
   uniqueTraders:traderIds.size,
   grossNotional,
   netYesFlow,
   yesShare:grossNotional?clamp(.5+netYesFlow/(2*grossNotional)):0.5,
   lastTradeAt
  });
 }
 return out.sort((a,b)=>Math.abs(b.netYesFlow)-Math.abs(a.netYesFlow)||b.grossNotional-a.grossNotional);
}

function normalizeText(value:string){
 return value
  .toLowerCase()
  .replace(/[^a-z0-9 ]+/g,' ')
  .replace(/\b(will|the|a|an|by|before|after|in|on|of|to|for|and|or|is|be|yes|no)\b/g,' ')
  .replace(/\s+/g,' ')
  .trim();
}

function tokens(value:string){
 return new Set(normalizeText(value).split(' ').filter(x=>x.length>1));
}

function similarity(a:string,b:string){
 const A=tokens(a),B=tokens(b);
 if(!A.size||!B.size)return 0;
 let intersection=0;
 for(const token of A)if(B.has(token))intersection++;
 const union=A.size+B.size-intersection;
 const jaccard=union?intersection/union:0;
 const containment=intersection/Math.max(1,Math.min(A.size,B.size));
 return Math.max(jaccard,containment*.82);
}

export function crossVenueGaps(contracts:PredictionContract[],limit=30):CrossVenueGap[]{
 const kalshi=contracts.filter(x=>x.source.toLowerCase()==='kalshi');
 const poly=contracts.filter(x=>x.source.toLowerCase()==='polymarket');
 const candidates:CrossVenueGap[]=[];
 for(const k of kalshi){
  let best:PredictionContract|undefined;
  let bestSim=0;
  for(const p of poly){
   const s=similarity(k.title,p.title);
   if(s>bestSim){best=p;bestSim=s}
  }
  if(!best||bestSim<.48)continue;
  const gap=k.yesProbability-best.yesProbability;
  candidates.push({
   kalshi:k,
   polymarket:best,
   similarity:bestSim,
   probabilityGap:gap,
   absoluteGap:Math.abs(gap),
   lowerVenue:gap<=0?'Kalshi':'Polymarket',
   higherVenue:gap<=0?'Polymarket':'Kalshi',
   lowerProbability:Math.min(k.yesProbability,best.yesProbability),
   higherProbability:Math.max(k.yesProbability,best.yesProbability),
   matchQuality:bestSim>=.72?'STRONG':'HEURISTIC'
  });
 }
 const seen=new Set<string>();
 return candidates
  .sort((a,b)=>b.absoluteGap-a.absoluteGap||b.similarity-a.similarity)
  .filter(row=>{
   const key=[row.kalshi.id,row.polymarket.id].join('|');
   if(seen.has(key))return false;
   seen.add(key);
   return true;
  })
  .slice(0,Math.max(1,limit));
}

function median(values:number[]){
 if(!values.length)return 0;
 const sorted=[...values].sort((a,b)=>a-b);
 const mid=Math.floor(sorted.length/2);
 return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
}

export function convictionTrades(trades:PredictionTrade[],limit=40){
 const byVenue=new Map<PredictionVenue,PredictionTrade[]>();
 for(const trade of trades)byVenue.set(trade.venue,[...(byVenue.get(trade.venue)||[]),trade]);
 const medians=new Map<PredictionVenue,number>();
 for(const [venue,rows] of byVenue)medians.set(venue,Math.max(1,median(rows.map(x=>x.notional).filter(x=>x>0))));
 const floor=Math.max(100,Number(process.env.PREDICTION_FLOW_MIN_NOTIONAL||500));
 return trades
  .map(trade=>{
   const base=medians.get(trade.venue)||1;
   const convictionMultiple=trade.notional/base;
   return {...trade,convictionMultiple};
  })
  .filter(x=>x.notional>=floor&&x.convictionMultiple>=2)
  .sort((a,b)=>b.convictionMultiple-a.convictionMultiple||b.notional-a.notional)
  .slice(0,limit);
}
