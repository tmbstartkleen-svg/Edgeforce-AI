/** Cloudflare D1 prediction arb watchlist and historical evidence capture.
 * Explicit operator authorization and write flag are required. No autonomous trades or push.
 */
import {predictionOrderbookGateway} from './prediction-orderbook-review';
type Statement={bind(...args:unknown[]):{first<T>():Promise<T|null>;all<T>():Promise<{results:T[]}>;run():Promise<{meta?:{changes?:number}}>} ;all<T>():Promise<{results:T[]}>};
type DB={prepare(sql:string):Statement};
type Env={CRON_SECRET?:unknown;INTELLIGENCE_DB?:unknown;PREDICTION_WATCH_WRITE_ENABLED?:unknown;PREDICTION_ORDERBOOK_ENABLED?:unknown};
type Watch={watch_id:string;kalshi_ticker:string;poly_yes_token:string;poly_no_token:string;minimum_net_roi_pct:number;contract_pairs:number;expiry_at:string|null;enabled:number;settlement_verified:number;created_at:string};
type Pair={kalshiYesPolyNo?:{kalshiYesAsk?:{priceCents:number;size:number}|null;polyNoAsk?:{priceCents:number;size:number}|null};polyYesKalshiNo?:{polyYesAsk?:{priceCents:number;size:number}|null;kalshiNoAsk?:{priceCents:number;size:number}|null}};
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const respond=(v:unknown,status=200)=>Response.json(v,{status,headers});
const numericId=(x:unknown)=>typeof x==='string'&&/^[0-9]{20,90}$/.test(x);
const tickerId=(x:unknown)=>typeof x==='string'&&/^[A-Z0-9-]{3,90}$/.test(x);
const watchId=(x:unknown)=>typeof x==='string'&&/^[a-zA-Z0-9_-]{8,90}$/.test(x);
const date=(x:unknown)=>typeof x==='string'&&Number.isFinite(Date.parse(x))?new Date(x).toISOString():null;
const protect=(request:Request,env:Env)=>typeof env.CRON_SECRET==='string'&&env.CRON_SECRET.length>=24&&request.headers.get('authorization')==='Bearer '+env.CRON_SECRET;
export async function predictionWatchLedger(request:Request,env:Env):Promise<Response>{
 if(!['GET','POST'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, POST'}});
 if(!protect(request,env))return respond({ok:false,error:'UNAUTHORIZED'},401);
 const db=env.INTELLIGENCE_DB as DB|undefined;if(!db?.prepare)return respond({ok:false,error:'D1_UNAVAILABLE'},503);
 if(request.method==='GET'){
  try{
   const [watches,observations,alerts]=await Promise.all([
    db.prepare('SELECT * FROM prediction_arbitrage_watches ORDER BY created_at DESC LIMIT 100').all<Watch>(),
    db.prepare('SELECT observation_id,watch_id,observed_at,minimum_combined_cents,status FROM prediction_arbitrage_observations ORDER BY observed_at DESC LIMIT 100').all<{observation_id:number;watch_id:string;observed_at:string;minimum_combined_cents:number|null;status:string}>(),
    db.prepare('SELECT alert_id,watch_id,status,reason,first_seen_at,delivery_state,confirmed_executable FROM prediction_arbitrage_alerts ORDER BY first_seen_at DESC LIMIT 100').all<{alert_id:number;watch_id:string;status:string;reason:string;first_seen_at:string;delivery_state:string;confirmed_executable:number}>()
   ]);
   return respond({ok:true,mode:'READ_ONLY_D1_PREDICTION_WATCH_LEDGER',watches:watches.results,observations:observations.results,alerts:alerts.results,
    writeEnabled:env.PREDICTION_WATCH_WRITE_ENABLED==='true',liveNotificationsEnabled:false,automatedMonitoringEnabled:false,
    executionCertified:false,externalRequests:0,ordersPlaced:0,oddsApiCreditsSpent:0});
  }catch{return respond({ok:false,error:'WATCH_SCHEMA_UNAVAILABLE_OR_QUERY_FAILED'},503)}
 }
 if(env.PREDICTION_WATCH_WRITE_ENABLED!=='true')return respond({ok:false,error:'WATCH_WRITES_DISABLED'},503);
 let data:unknown;try{data=await request.json()}catch{return respond({ok:false,error:'INVALID_JSON'},400)}
 if(!data||typeof data!=='object'||Array.isArray(data))return respond({ok:false,error:'INVALID_PAYLOAD'},400);
 const input=data as Record<string,unknown>;
 if(input.action==='REGISTER'){
  const {watchId,kalshiTicker,polyYesToken,polyNoToken,minimumNetRoiPct,contractPairs,expiryAt,confirm}=input;
  const expiry=expiryAt===null?null:date(expiryAt);
  if(confirm!=='CREATE_DISABLED_WATCH'||!watchId||!tickerId(kalshiTicker)||!numericId(polyYesToken)||!numericId(polyNoToken)||
   polyYesToken===polyNoToken||typeof minimumNetRoiPct!=='number'||!Number.isFinite(minimumNetRoiPct)||Number(minimumNetRoiPct)<0||Number(minimumNetRoiPct)>100||
   typeof contractPairs!=='number'||!Number.isInteger(contractPairs)||Number(contractPairs)<1||Number(contractPairs)>100000||
   !watchIdPattern(watchId)||expiryAt!==null&&!expiry)return respond({ok:false,error:'INVALID_WATCH_REGISTRATION'},400);
  try{
   const inserted=await db.prepare(`INSERT OR IGNORE INTO prediction_arbitrage_watches
    (watch_id,kalshi_ticker,poly_yes_token,poly_no_token,minimum_net_roi_pct,contract_pairs,expiry_at,
     settlement_verified,enabled) VALUES(?,?,?,?,?,?,?,0,0)`)
    .bind(watchId,kalshiTicker,polyYesToken,polyNoToken,minimumNetRoiPct,contractPairs,expiry).run();
   return respond({ok:true,status:inserted.meta?.changes===1?'REGISTERED_DISABLED':'EXISTING_OR_IGNORED',
    watchId,enabled:false,settlementCertified:false,liveNotificationsEnabled:false,oddsApiCreditsSpent:0});
  }catch{return respond({ok:false,error:'WATCH_REGISTRATION_FAILED'},503)}
 }
 if(input.action==='OBSERVE'){
  if(!watchId(input.watchId)||input.confirm!=='CAPTURE_EVIDENCE_ONLY')return respond({ok:false,error:'INVALID_OBSERVATION_REQUEST'},400);
  const id=input.watchId as string;
  let watch:Watch|null;try{watch=await db.prepare('SELECT * FROM prediction_arbitrage_watches WHERE watch_id=?').bind(id).first<Watch>()}
  catch{return respond({ok:false,error:'WATCH_LOOKUP_FAILED'},503)}
  if(!watch)return respond({ok:false,error:'WATCH_NOT_FOUND'},404);
  if(env.PREDICTION_ORDERBOOK_ENABLED!=='true')return respond({ok:false,error:'PUBLIC_ORDERBOOK_REVIEW_DISABLED'},503);
  const base=new URL(request.url);base.searchParams.set('kalshi',watch.kalshi_ticker);
  base.searchParams.set('polyYes',watch.poly_yes_token);base.searchParams.set('polyNo',watch.poly_no_token);
  const lookup=new Request(base,{method:'GET',headers:{authorization:request.headers.get('authorization')||''}});
  const response=await predictionOrderbookGateway(lookup,env);
  if(!response.ok)return respond({ok:false,error:'ORDERBOOK_REVIEW_FAILED',sourceStatus:response.status},503);
  let observations:unknown;try{observations=await response.json()}catch{return respond({ok:false,error:'ORDERBOOK_JSON_INVALID'},503)}
  const market=observations&&typeof observations==='object'?observations as Record<string,unknown>:{};
  const pairs=(market.pairs||{}) as Pair;
  const a=pairs.kalshiYesPolyNo||{},b=pairs.polyYesKalshiNo||{};
  const combinedA=a.kalshiYesAsk&&a.polyNoAsk?a.kalshiYesAsk.priceCents+a.polyNoAsk.priceCents:null;
  const combinedB=b.polyYesAsk&&b.kalshiNoAsk?b.polyYesAsk.priceCents+b.kalshiNoAsk.priceCents:null;
  const validPrices=[combinedA,combinedB].filter((n):n is number=>n!==null&&Number.isFinite(n));
  const min=validPrices.length?Math.min(...validPrices):null;
  const status=min===null?'INCOMPLETE_BOOK':min>=100?'NO_SPREAD':'REVIEW_REQUIRED';
  const at=new Date().toISOString();
  const evidence=JSON.stringify({source:'PUBLIC_BOOK_SNAPSHOT',sourceResponseTimestampVerified:false,
   feesVerified:false,settlementCertified:false,executionCertified:false,pairs,bookWarnings:market.warnings||[],
   minQuotedCostCents:min,thresholdNetRoiPct:watch.minimum_net_roi_pct,
   feeAdjustedNetRoi:null,alertDelivery:false});
  try{
   const write=await db.prepare(`INSERT INTO prediction_arbitrage_observations
    (watch_id,observed_at,kalshi_yes_ask_cents,kalshi_no_ask_cents,poly_yes_ask_cents,poly_no_ask_cents,
    minimum_combined_cents,status,evidence_json) VALUES(?,?,?,?,?,?,?,?,?)`).bind(
    id,at,a.kalshiYesAsk?.priceCents??null,b.kalshiNoAsk?.priceCents??null,
    b.polyYesAsk?.priceCents??null,a.polyNoAsk?.priceCents??null,min,status,evidence).run();
   if(write.meta?.changes!==1)return respond({ok:false,error:'OBSERVATION_WRITE_NOT_VERIFIED'},503);
   return respond({ok:true,status,watchId:id,observedAt:at,minimumCombinedCents:min,
    informationalOnly:true,feesVerified:false,settlementCertified:false,
    executableArbitrageCertified:false,alertDelivered:false,ordersPlaced:0,oddsApiCreditsSpent:0});
  }catch{return respond({ok:false,error:'OBSERVATION_WRITE_FAILED'},503)}
 }
 return respond({ok:false,error:'UNKNOWN_OR_DISALLOWED_ACTION'},400);
}
function watchIdPattern(x:unknown){return watchId(x)}
