/** Founder-safe D1 odds archive: explicit opt-in writes, authenticated read-only provenance.
 * This is NOT a market collector and never infers independently verified prices.
 */
import {appendSportsMarketSnapshot} from '../src/lib/intelligence-core/d1-sports-market-store.mjs';

type Quote={
 sourceId:string;upstreamId:string;sourceEventId:string;sport:string;league:string;
 home:string;away:string;startTime:string;market:string;selection:string;bookmaker:string;
 odds:number;observedAt:number;
};
type Db={
 prepare(sql:string):{
  bind(...args:unknown[]):{first<T=unknown>():Promise<T|null>;run():Promise<{meta?:{changes?:number}}>;all<T=unknown>():Promise<{results:T[]}>};
  first<T=unknown>():Promise<T|null>;
 };
};
type Env={
 INGEST_SECRET?:unknown;CRON_SECRET?:unknown;INTELLIGENCE_DB?:unknown;
 D1_SPORTS_MARKET_ARCHIVE_ENABLED?:unknown;
};
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers});
const auth=(request:Request,secret:unknown)=>typeof secret==='string'&&secret.length>=24&&
 request.headers.get('authorization')==='Bearer '+secret;
const string=(x:unknown)=>typeof x==='string'&&x.length>0&&x.length<=160;
const validIso=(x:unknown)=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&
 new Date(x).toISOString()===x;
const MAX_AGE_MS=15*60_000;
const MAX_BATCH=25;
const MAX_BODY=64*1024;
const MAX_SAMPLE=500;

function validateQuote(value:unknown,now:number):value is Quote{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Record<string,unknown>;
 const fields=['sourceId','upstreamId','sourceEventId','sport','league','home','away','startTime','market','selection','bookmaker'];
 if(!fields.every(k=>string(v[k])))return false;
 if(!validIso(v.startTime))return false;
 if(!Number.isSafeInteger(v.odds)||Math.abs(v.odds as number)<100||Math.abs(v.odds as number)>100000)return false;
 if(!Number.isSafeInteger(v.observedAt)||v.observedAt as number>now+30_000||now-(v.observedAt as number)>MAX_AGE_MS)return false;
 if(new Date(v.startTime as string).getTime()<now-12*60*60_000)return false;
 return true;
}

export async function d1SportsMarketArchiveIngest(request:Request,env:Env):Promise<Response>{
 if(request.method!=='POST')return new Response(null,{status:405,headers:{...headers,Allow:'POST'}});
 if(!auth(request,env.INGEST_SECRET))return reply({ok:false,reason:'UNAUTHORIZED'},401);
 if(env.D1_SPORTS_MARKET_ARCHIVE_ENABLED!=='true')
  return reply({ok:false,reason:'SPORTS_ARCHIVE_WRITE_DISABLED'},503);
 const db=env.INTELLIGENCE_DB as Db|undefined;
 if(!db||typeof db.prepare!=='function')return reply({ok:false,reason:'D1_BINDING_MISSING'},503);
 if(Number(request.headers.get('content-length')||0)>MAX_BODY)return reply({ok:false,reason:'PAYLOAD_TOO_LARGE'},413);
 let body:unknown;
 try{
  const raw=await request.text();
  if(new TextEncoder().encode(raw).length>MAX_BODY)return reply({ok:false,reason:'PAYLOAD_TOO_LARGE'},413);
  body=JSON.parse(raw);
 }catch{return reply({ok:false,reason:'INVALID_JSON'},400);}
 if(!Array.isArray(body)||body.length<1||body.length>MAX_BATCH)return reply({ok:false,reason:'INVALID_BATCH'},400);
 const now=Date.now();
 if(!body.every(v=>validateQuote(v,now)))return reply({ok:false,reason:'INVALID_OR_STALE_QUOTE'},400);
 const quotes=body as Quote[];
 // All records must be from explicitly enabled, ODDS-class, matching upstreams.
 // Validate the full batch before any mutation to avoid partial approval failures.
 try{
  const permitted=new Map<string,string>();
  for(const quote of quotes){
   if(!permitted.has(quote.sourceId)){
    const source=await db.prepare("SELECT upstream_id,source_type FROM intelligence_sources WHERE source_id=? AND enabled=1")
     .bind(quote.sourceId).first<{upstream_id:string;source_type:string}>();
    if(!source||source.source_type!=='ODDS')return reply({ok:false,reason:'SOURCE_NOT_APPROVED'},403);
    permitted.set(quote.sourceId,source.upstream_id);
   }
   if(permitted.get(quote.sourceId)!==quote.upstreamId)return reply({ok:false,reason:'UPSTREAM_MISMATCH'},403);
  }
  let inserted=0,duplicates=0;
  for(const quote of quotes){
   const result=await appendSportsMarketSnapshot(db,quote,{sourceApproved:true,now});
   if(result.written===1)inserted++;
   else if(result.written===0)duplicates++;
   else return reply({ok:false,reason:'UNVERIFIED_WRITE_RESULT',inserted,duplicates},503);
  }
  return reply({ok:true,kind:'APPROVED_D1_ODDS_ARCHIVE',processed:quotes.length,inserted,duplicates,
   sourceCount:permitted.size,marketCoverageComplete:false,independentVerificationCertified:false,
   automaticWagering:false});
 }catch{
  return reply({ok:false,reason:'D1_ARCHIVE_WRITE_FAILED'},503);
 }
}

type ArchiveRow={
 source_id:string;upstream_id:string;source_event_id:string;sport:string;league:string;
 market_key:string;selection_key:string;bookmaker:string;source_observed_at:string;
};
export async function d1SportsMarketArchiveReadiness(request:Request,env:Env):Promise<Response>{
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...headers,Allow:'GET'}});
 if(!auth(request,env.CRON_SECRET))return reply({ok:false,reason:'UNAUTHORIZED'},401);
 const db=env.INTELLIGENCE_DB as Db|undefined;
 if(!db||typeof db.prepare!=='function')return reply({ok:false,reason:'D1_BINDING_MISSING'},503);
 try{
  const now=Date.now();
  const count=await db.prepare('SELECT COUNT(*) AS total,MAX(source_observed_at) AS newest FROM sports_market_snapshots')
   .first<{total:number;newest:string|null}>();
  const approved=await db.prepare("SELECT COUNT(*) AS total FROM intelligence_sources WHERE enabled=1 AND source_type='ODDS'")
   .first<{total:number}>();
  const results=await db.prepare(`SELECT s.source_id,s.upstream_id,s.source_event_id,s.sport,s.league,
      s.market_key,s.selection_key,s.bookmaker,s.source_observed_at
    FROM sports_market_snapshots s JOIN intelligence_sources p
      ON p.source_id=s.source_id AND p.upstream_id=s.upstream_id
      AND p.enabled=1 AND p.source_type='ODDS'
    WHERE s.source_observed_at>=?
    ORDER BY s.source_observed_at DESC LIMIT ?`)
   .bind(new Date(now-MAX_AGE_MS).toISOString(),MAX_SAMPLE).all<ArchiveRow>();
  const valid=(results.results||[]).filter(r=>Number.isFinite(Date.parse(r.source_observed_at))&&
   Date.parse(r.source_observed_at)<=now+30000);
  const upstreams=[...new Set(valid.map(x=>x.upstream_id))].sort();
  const providers=[...new Set(valid.map(x=>x.source_id))].sort();
  const bookmakers=[...new Set(valid.map(x=>x.bookmaker))].sort();
  const sports=[...new Set(valid.map(x=>x.sport))].sort();
  const leagues=[...new Set(valid.map(x=>x.sport+' / '+x.league))].sort();
  const freshRows=valid.length;
  const status=Number(count?.total||0)===0?'NO_ARCHIVED_ODDS':freshRows===0?'NO_FRESH_APPROVED_ODDS':
   upstreams.length===1?'SINGLE_UPSTREAM_DEGRADED':'MULTIPLE_UPSTREAM_INVENTORY_ONLY';
  return reply({ok:true,kind:'D1_SPORTS_ARCHIVE_READINESS',status,asOf:new Date(now).toISOString(),
   archiveWriteEnabled:env.D1_SPORTS_MARKET_ARCHIVE_ENABLED==='true',
   totalStoredRows:Number(count?.total||0),lastStoredObservation:count?.newest||null,
   approvedSourceCount:Number(approved?.total||0),freshApprovedSampleRows:freshRows,
   sampleLimit:MAX_SAMPLE,sampleTruncated:freshRows===MAX_SAMPLE,
   independentUpstreams:upstreams.length,upstreams,providers,bookmakers,sports,leagues,
   crossBookMarketsVerified:0,independentFairOddsCertified:false,playerPropCoverageCertified:false,
   marketCoverageComplete:false,expectedValueCertified:false,automaticWagering:false});
 }catch{return reply({ok:false,reason:'D1_ARCHIVE_READINESS_FAILED'},503);}
}
