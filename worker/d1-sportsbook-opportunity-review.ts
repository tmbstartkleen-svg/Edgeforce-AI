/** Authenticated read-only source-backed sportsbook value and arbitrage review on Cloudflare D1.
 * Zero API credits, no inference of settlement or forecast accuracy, no orders.
 */
import {scanArbitrage} from '../src/lib/intelligence-core/market-opportunity-engine.mjs';
import {lineMovementSeries,matchedNoVig} from '../src/lib/intelligence-core/market-identity-and-movement.mjs';
import {reviewD1ModelEdges} from '../src/lib/intelligence-core/d1-verified-edge-join.mjs';
type D1={prepare(sql:string):{bind(...args:unknown[]):{all<T>():Promise<{results:T[]}>}}};
type Env={CRON_SECRET?:unknown;INTELLIGENCE_DB?:unknown};
type Archived={source_id:string;upstream_id:string;source_event_id:string;market_key:string;selection_key:string;
 bookmaker:string;american_odds:number;source_observed_at:string;raw_json:string};
type Registry={source_id:string;upstream_id:string};
type ModelRun={id:number;event_id:string;market_key:string;selection_key:string;model_version:string;run_count:number;
 model_probability:number;confidence:number|null;feature_snapshot:string;created_at:string};
type Calibration={id:number;model_version:string|null;sport:string|null;market_key:string|null;sample_size:number|null;
 brier_score:number|null;log_loss:number|null;calibration_error:number|null;period_end:string|null;created_at:string};
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers});
const nonempty=(x:unknown)=>typeof x==='string'&&x.trim().length>0;
const validPrice=(a:unknown)=>Number.isInteger(a)&&((a as number)<=-100||(a as number)>=100);
const sourceTime=(value:unknown)=>{
 if(typeof value==='number')return Number.isFinite(value)?value:NaN;
 if(typeof value==='string'&&value.trim())return Date.parse(value);
 return NaN;
};
/** Preserve the primary quoted price and actual source timestamp; no receipt-time substitution. */
export function normalizeD1OpportunityQuotes(rows:Archived[],approved:Registry[],now=Date.now()){
 const permitted=new Map(approved.map(x=>[x.source_id,x.upstream_id]));
 const quotes:Record<string,unknown>[]=[],rejections:Record<string,number>={};
 const reject=(code:string)=>{rejections[code]=(rejections[code]||0)+1};
 for(const row of rows.slice(0,1000)){
  if(permitted.get(row.source_id)!==row.upstream_id){reject('UNAPPROVED_UPSTREAM');continue;}
  if(!validPrice(row.american_odds)||!nonempty(row.source_observed_at)){reject('INVALID_QUOTE');continue;}
  const observedAt=Date.parse(row.source_observed_at);
  if(!Number.isFinite(observedAt)||observedAt>now+30000||now-observedAt>20*60000){reject('STALE_SOURCE_TIME');continue;}
  let raw:Record<string,unknown>;
  try{const p=JSON.parse(row.raw_json);if(!p||typeof p!=='object'||Array.isArray(p))throw Error('INVALID');raw=p}catch{reject('CORRUPT_RAW_EVIDENCE');continue;}
  // D1 archived identity is authoritative; reject any contradictory raw fields.
  if(raw.sourceId!==row.source_id||raw.upstreamId!==row.upstream_id||raw.sourceEventId!==row.source_event_id||
   raw.market!==row.market_key||raw.selection!==row.selection_key||raw.bookmaker!==row.bookmaker||
   raw.odds!==row.american_odds||raw.observedAt!==observedAt){reject('ARCHIVE_RAW_IDENTITY_CONFLICT');continue;}
  if(!nonempty(raw.settlementKey)||!['TWO_WAY','THREE_WAY'].includes(String(raw.outcomeSetType))||
   !Array.isArray(raw.outcomes)||!raw.outcomes.every(nonempty)||!nonempty(raw.currency)){
    reject('UNVERIFIED_SETTLEMENT_OR_OUTCOMES');continue;
  }
  if(raw.venueType!=='SPORTSBOOK'||(raw.side!==undefined&&raw.side!=='BACK')){reject('UNSUPPORTED_VENUE_SIDE');continue;}
  const eventStartTime=sourceTime(raw.eventStartTime??raw.startTime);
  const quote={eventId:row.source_event_id,marketKey:row.market_key,selection:row.selection_key,
   bookmaker:row.bookmaker,providerId:row.source_id,upstreamId:row.upstream_id,
   observedAt,odds:row.american_odds,settlementKey:raw.settlementKey,currency:raw.currency,
   venueType:'SPORTSBOOK',side:'BACK',outcomeSetType:raw.outcomeSetType,outcomes:raw.outcomes,
   ...(nonempty(raw.sport)?{sport:raw.sport}:{}),
   ...(Number.isFinite(eventStartTime)?{eventStartTime}:{}),
   ...(raw.lineKey!==undefined?{lineKey:raw.lineKey}:{}),
   ...(raw.periodKey!==undefined?{periodKey:raw.periodKey}:{}),
   ...(raw.playerId!==undefined?{playerId:raw.playerId}:{}),
   ...(raw.statKey!==undefined?{statKey:raw.statKey}:{})};
  quotes.push(quote);
 }
 return {quotes,rejections,rowsExamined:Math.min(rows.length,1000),acceptedQuotes:quotes.length,
  authority:'APPROVED_D1_SOURCE_REGISTRY_ONLY',sourceTimestampRequired:true,networkRequests:0};
}
export async function d1SportsbookOpportunityReview(request:Request,env:Env):Promise<Response>{
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...headers,Allow:'GET'}});
 const secret=env.CRON_SECRET;
 if(typeof secret!=='string'||secret.length<24)return json({ok:false,error:'AUTH_NOT_CONFIGURED'},503);
 if(request.headers.get('authorization')!=='Bearer '+secret)return json({ok:false,error:'UNAUTHORIZED'},401);
 const db=env.INTELLIGENCE_DB as D1|undefined;
 if(!db?.prepare)return json({ok:false,error:'D1_UNAVAILABLE'},503);
 try{
  const now=Date.now();
  const [stored,sources,models,calibration]=await Promise.all([
   db.prepare(`SELECT source_id,upstream_id,source_event_id,market_key,selection_key,bookmaker,
      american_odds,source_observed_at,raw_json FROM sports_market_snapshots
      WHERE source_observed_at>=? AND source_observed_at<=?
      ORDER BY source_observed_at DESC LIMIT 1000`)
     .bind(new Date(now-20*60000).toISOString(),new Date(now+30000).toISOString()).all<Archived>(),
   db.prepare(`SELECT source_id,upstream_id FROM intelligence_sources
      WHERE enabled=1 AND source_type='ODDS' LIMIT 200`).bind().all<Registry>(),
   db.prepare(`SELECT id,event_id,market_key,selection_key,model_version,run_count,model_probability,
      confidence,feature_snapshot,created_at FROM model_runs
      WHERE created_at>=? AND created_at<=? ORDER BY created_at DESC,id DESC LIMIT 1000`)
     .bind(new Date(now-48*60*60*1000).toISOString(),new Date(now+30000).toISOString()).all<ModelRun>(),
   db.prepare(`SELECT id,model_version,sport,market_key,sample_size,brier_score,log_loss,
      calibration_error,period_end,created_at FROM calibration_metrics
      ORDER BY created_at DESC,id DESC LIMIT 1000`).bind().all<Calibration>()
  ]);
  const verified=normalizeD1OpportunityQuotes(stored.results||[],sources.results||[],now);
  const opportunities=scanArbitrage(verified.quotes,{now,maxAgeMs:20*60000,bankroll:100});
  const movement=lineMovementSeries(verified.quotes,{now,maxAgeMs:20*60000,maxRows:1000});
  const noVig=matchedNoVig(verified.quotes,{now,maxAgeMs:20*60000});
  const modelEdgeReview=reviewD1ModelEdges(verified.quotes,models.results||[],calibration.results||[],{now,targetBook:'DraftKings'});
  return json({ok:true,mode:'READ_ONLY_D1_OPPORTUNITY_REVIEW',generatedAt:new Date(now).toISOString(),
   status:verified.acceptedQuotes===0?'NO_ELIGIBLE_VERIFIED_QUOTES':'EVIDENCE_ONLY',verified,
   opportunities,movement,noVig,modelEdgeReview,modelVerifiedEdges:[],modelCalibrationCertified:false,
   storedModelCalibrationEvidenceMatched:modelEdgeReview.calibrationMatched>0,
   licensedLiveBookmakerCoverageCertified:false,independentOperatorOwnershipCertified:false,
   executableArbitrageCertified:false,ordersPlaced:0,oddsApiCreditsSpent:0,externalRequests:0,
   warnings:['Historical D1 quote visibility is not proof a bet is available or executable.',
    'Missing or inconsistent outcome and settlement data prevents arbitrage comparison.',
    'Model +EV review joins only stored independent-model assertions, prior calibration rows, exact post-forecast quotes and canonical market identity.',
    'Validation grades and IDs are model-supplied assertions; this D1 review does not independently verify validation-lab records.',
    'A review candidate is not an authorized bet: registered upstream IDs are not independently authenticated ownership, execution is NONE, and modelVerifiedEdges remains empty.']});
 }catch{return json({ok:false,error:'D1_OPPORTUNITY_READ_FAILED',externalRequests:0},503)}
}
