/** Public orderbook review for explicitly selected Kalshi and Polymarket contracts.
 * No automatic equivalence from title. Public bids/asks are not guaranteed fills.
 */
type Level={priceCents:number;size:number};
type Book={exchange:'Kalshi'|'Polymarket';id:string;yesAsk:Level|null;noAsk:Level|null;asOf:string;source:string;depthType:string};
const valid=(n:number)=>Number.isFinite(n)&&n>=0;
const level=(value:unknown,size:unknown,scale:number):Level|null=>{
 const p=Number(value),s=Number(size);
 return value===null||value===undefined||size===null||size===undefined||!valid(p)||!valid(s)||p>scale||s===0?
  null:{priceCents:Math.round(p*10000/scale)/100,size:s};
};
function offers(raw:unknown,scale:number):Level[]{
 if(!Array.isArray(raw))return[];
 return raw.slice(0,50).flatMap(x=>{
  if(!x||typeof x!=='object')return[];
  const v=x as Record<string,unknown>;
  const l=Array.isArray(x)?level(x[0],x[1],scale):level(v.price,v.size,scale);
  return l?[l]:[];
 });
}
function highestBid(rows:unknown,scale:number){
 const levels=Array.isArray(rows)?rows.slice(0,60).map(x=>Array.isArray(x)?level(x[0],x[1],scale):null).filter((x):x is Level=>x!==null):[];
 return levels.sort((a,b)=>b.priceCents-a.priceCents)[0]||null;
}
export function parseKalshiOrderbook(raw:unknown,ticker:string,asOf:string):Book{
 const outer=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
 const fp=outer.orderbook_fp&&typeof outer.orderbook_fp==='object'?outer.orderbook_fp as Record<string,unknown>:{};
 const legacy=outer.orderbook&&typeof outer.orderbook==='object'?outer.orderbook as Record<string,unknown>:{};
 const yesBid=highestBid(fp.yes_dollars,1)||highestBid(legacy.yes,100);
 const noBid=highestBid(fp.no_dollars,1)||highestBid(legacy.no,100);
 const buyFromOpposite=(bid:Level|null):Level|null=>bid?{priceCents:Math.round((100-bid.priceCents)*100)/100,size:bid.size}:null;
 return {exchange:'Kalshi',id:ticker,yesAsk:buyFromOpposite(noBid),noAsk:buyFromOpposite(yesBid),asOf,source:'PUBLIC_BID_SIDE_DERIVED',depthType:'BEST_BID_COMPLEMENT_ONLY'};
}
export function parsePolymarketOrderbook(raw:unknown,token:string,asOf:string):Book{
 const m=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
 if(typeof m.asset_id==='string'&&m.asset_id!==token)throw Error('POLY_TOKEN_MISMATCH');
 const asks=offers(m.asks,1).sort((a,b)=>a.priceCents-b.priceCents);
 return {exchange:'Polymarket',id:token,yesAsk:asks[0]||null,noAsk:null,asOf,source:'PUBLIC_ASK_BOOK',depthType:'TOKEN_SPECIFIC_ASKS'};
}
type Env={CRON_SECRET?:unknown;PREDICTION_ORDERBOOK_ENABLED?:unknown};
const hdr={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:hdr});
async function limitedFetch(url:string){
 const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),5000);
 try{const r=await fetch(url,{redirect:'error',headers:{Accept:'application/json'},signal:ctl.signal});
  if(!r.ok)throw Error('BOOK_HTTP_'+r.status);
  if(Number(r.headers.get('content-length')||0)>400000)throw Error('BOOK_TOO_LARGE');
  const body=await r.text();if(body.length>400000)throw Error('BOOK_TOO_LARGE');return JSON.parse(body);
 }finally{clearTimeout(timer)}
}
export async function predictionOrderbookGateway(request:Request,env:Env):Promise<Response>{
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...hdr,Allow:'GET'}});
 if(typeof env.CRON_SECRET!=='string'||env.CRON_SECRET.length<24)return reply({ok:false,error:'AUTH_NOT_CONFIGURED'},503);
 if(request.headers.get('authorization')!=='Bearer '+env.CRON_SECRET)return reply({ok:false,error:'UNAUTHORIZED'},401);
 if(env.PREDICTION_ORDERBOOK_ENABLED!=='true')return reply({ok:false,error:'ORDERBOOK_REVIEW_DISABLED'},503);
 const url=new URL(request.url),ticker=url.searchParams.get('kalshi')||'';
 const yesToken=url.searchParams.get('polyYes')||'',noToken=url.searchParams.get('polyNo')||'';
 if(!/^[A-Z0-9-]{3,90}$/.test(ticker)||!/^[0-9]{20,90}$/.test(yesToken)||
  !/^[0-9]{20,90}$/.test(noToken)||yesToken===noToken)return reply({ok:false,error:'INVALID_MARKET_IDENTIFIERS'},400);
 const now=new Date().toISOString();
 const endpoints=[
  'https://api.elections.kalshi.com/trade-api/v2/markets/'+encodeURIComponent(ticker)+'/orderbook',
  'https://clob.polymarket.com/book?token_id='+encodeURIComponent(yesToken),
  'https://clob.polymarket.com/book?token_id='+encodeURIComponent(noToken)
 ];
 const results=await Promise.allSettled(endpoints.map(limitedFetch));
 const warnings:string[]=[];
 const safe=(i:number,fn:(x:unknown)=>Book):Book|null=>{
  if(results[i].status!=='fulfilled'){warnings.push('EXCHANGE_BOOK_'+i+'_UNAVAILABLE');return null;}
  try{return fn(results[i].value)}catch{warnings.push('EXCHANGE_BOOK_'+i+'_INVALID');return null;}
 };
 const kalshi=safe(0,x=>parseKalshiOrderbook(x,ticker,now));
 const polyYes=safe(1,x=>parsePolymarketOrderbook(x,yesToken,now));
 const polyNo=safe(2,x=>parsePolymarketOrderbook(x,noToken,now));
 const pairs={
  kalshiYesPolyNo:{kalshiYesAsk:kalshi?.yesAsk??null,polyNoAsk:polyNo?.yesAsk??null},
  polyYesKalshiNo:{polyYesAsk:polyYes?.yesAsk??null,kalshiNoAsk:kalshi?.noAsk??null}
 };
 return reply({ok:true,mode:'PUBLIC_ORDERBOOK_READ_ONLY',asOf:now,requested:{ticker,yesToken,noToken},
  books:{kalshi,polymarketYes:polyYes,polymarketNo:polyNo},pairs,warnings,
  sourceResponseTimestampVerified:false,requestRoundtripSimultaneous:false,
  sameResolutionCertified:false,feeSchedulesVerified:false,payoutEquivalenceCertified:false,
  executableArbitrageCertified:false,marketOrderFillGuaranteed:false,
  alertsEligible:false,ordersPlaced:0,paidOddsApiCreditsSpent:0,
  notes:['Kalshi buy asks are derived from opposite-side bids; book quantities and fractional contract rules need confirmation.',
   'Polymarket YES and NO token books are separate; price and size alone cannot prove comparable settlement or actual fill.',
   'Exchange responses are not atomic. Report as an observed snapshot, not a guarantee of available arbitrage.']});
}
