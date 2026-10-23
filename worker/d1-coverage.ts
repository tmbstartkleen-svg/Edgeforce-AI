import {checkNetworkAuth} from '../src/lib/firstPartySportsNetwork';
import {reconcileCoverage,type CoverageObservation} from '../src/lib/coverage-inventory';
import {independentQuoteConsensus,type ConsensusQuote} from '../src/lib/independent-quote-consensus';
import type {D1Database} from './d1-observations';
type Row={source_id:string;upstream_id:string;event_id:string;observed_at:string;payload:string};
const noStore={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:noStore});
const str=(v:unknown)=>typeof v==='string'&&v.trim().length>0?v.trim():'';
/** Read real persisted D1 odds observations; no network fetch or unapproved provider quote inference. */
export async function d1CoverageGateway(request:Request,env:{CRON_SECRET?:unknown;EDGEFORCE_NETWORK_TOKEN_SHA256?:unknown;INTELLIGENCE_DB?:unknown}):Promise<Response>{
 if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET'}});
 const ownerAuthorized=typeof env.EDGEFORCE_NETWORK_TOKEN_SHA256==='string'&&
    checkNetworkAuth(request.headers.get('authorization'),env.EDGEFORCE_NETWORK_TOKEN_SHA256);
 const cronAuthorized=typeof env.CRON_SECRET==='string'&&env.CRON_SECRET.length>=24&&
    request.headers.get('authorization')==='Bearer '+env.CRON_SECRET;
 if(!ownerAuthorized&&!cronAuthorized)
  return json({ok:false,error:'UNAUTHORIZED'},401);
 const db=env.INTELLIGENCE_DB as D1Database|undefined;
 if(!db||typeof db.prepare!=='function')return json({ok:false,error:'D1_BINDING_MISSING'},503);
 const u=new URL(request.url),limit=Number(u.searchParams.get('limit')||100);
 if(!Number.isSafeInteger(limit)||limit<1||limit>250)return json({ok:false,error:'INVALID_LIMIT'},400);
 try{
  const records=await db.prepare(`SELECT o.source_id,o.upstream_id,o.event_id,o.observed_at,o.payload
    FROM intelligence_observations AS o
    INNER JOIN intelligence_sources AS s ON s.source_id=o.source_id
      AND s.upstream_id=o.upstream_id AND s.enabled=1
    WHERE o.observation_kind='odds' AND o.source_id NOT LIKE 'espn-scoreboard-%'
    ORDER BY o.observed_at DESC LIMIT ?`).bind(limit).all<Row>();
  const now=Date.now(),observations:CoverageObservation[]=[],consensusQuotes:ConsensusQuote[]=[];let unrecognized=0;
  for(const record of records.results){
   let p:Record<string,unknown>;
   try{p=JSON.parse(record.payload);}catch{unrecognized++;continue;}
   if(!p||typeof p!=='object'||Array.isArray(p)){unrecognized++;continue;}
   // D1 persists the normalized observation envelope; quote fields belong to value.
   const q=(p.value&&typeof p.value==='object'&&!Array.isArray(p.value)?p.value:p) as Record<string,unknown>;
   const bookmaker=str(q.bookmaker),sport=str(q.sport),league=str(q.league);
   const marketType=str(q.marketType),outcomeId=str(q.outcomeId),startsAt=str(q.startsAt);
   if(!bookmaker||!sport||!league||!marketType||!outcomeId||!startsAt){unrecognized++;continue;}
   const price=q.priceAmerican;
   if(price!==undefined&&(!Number.isInteger(price)||Math.abs(price as number)<100)){unrecognized++;continue;}
   if(str(record.upstream_id)&&price!==undefined)consensusQuotes.push({upstreamId:str(record.upstream_id),providerId:record.source_id,bookmaker,sport,league,eventId:record.event_id,marketType,outcomeId,observedAt:record.observed_at,startsAt,priceAmerican:price as number,...(str(q.playerId)?{playerId:str(q.playerId)}:{}),...(str(q.line)?{line:str(q.line)}:{})});
   observations.push({provider:record.source_id,bookmaker,sport,league,eventId:record.event_id,
    marketType,outcomeId,observedAt:record.observed_at,startsAt,
    ...(price!==undefined?{priceAmerican:price as number}:{}),
    ...(str(q.playerId)?{playerId:str(q.playerId)}:{}),
    ...(str(q.line)?{line:str(q.line)}:{})});
  }
  const report=reconcileCoverage({observations,expected:[],now:new Date(now).toISOString(),
   maxAgeMs:15*60*1000,targetBookmaker:'DraftKings'});
  // Dynamic inventory from genuinely observed outcomes, not a hardcoded sports list.
  const groups=new Map<string,{sport:string;league:string;events:Set<string>;marketTypes:Set<string>;players:Set<string>;quotes:number;latestObservedAt:string}>();
  for(const o of report.observations){
   const key=[o.sport,o.league].map(x=>x.trim().toLowerCase()).join('|');
   let group=groups.get(key);
   if(!group){group={sport:o.sport,league:o.league,events:new Set(),marketTypes:new Set(),players:new Set(),quotes:0,latestObservedAt:o.observedAt};groups.set(key,group);}
   group.events.add(o.eventId);group.marketTypes.add(o.marketType);
   if(o.playerId)group.players.add(o.playerId);
   if(o.priceAmerican!==undefined)group.quotes++;
   if(Date.parse(o.observedAt)>Date.parse(group.latestObservedAt))group.latestObservedAt=o.observedAt;
  }
  const leagues=[...groups.values()].map(g=>({sport:g.sport,league:g.league,events:g.events.size,marketTypes:g.marketTypes.size,players:g.players.size,quotes:g.quotes,latestObservedAt:g.latestObservedAt}))
   .sort((a,b)=>a.sport.localeCompare(b.sport)||a.league.localeCompare(b.league));
  const providers=[...new Set(report.observations.map(o=>o.provider))].sort();
  // Coverage inventory deduplicates by market outcome across feeds. Independent
  // corroboration must retain each valid upstream quote rather than filtering by
  // only the surviving inventory quote. The consensus validator checks timestamps,
  // future start and exact event/outcome/player/line identities independently.
  const eligibleQuotes=consensusQuotes.filter(q=>q.bookmaker.trim().toLowerCase()==='draftkings'&&
    Number.isFinite(Date.parse(q.observedAt))&&Date.parse(q.observedAt)<=now&&now-Date.parse(q.observedAt)<=15*60*1000&&
    Number.isFinite(Date.parse(q.startsAt))&&Date.parse(q.startsAt)>now);
  const consensus=independentQuoteConsensus(eligibleQuotes,new Date(now).toISOString(),15*60*1000,30000);
  const freshUpstreamCount=new Set(eligibleQuotes.map(q=>q.upstreamId.trim().toLowerCase())).size;
  const independentVerification={independentUpstreams:freshUpstreamCount,crossProviderVerified:consensus.verifiedOutcomes>0,priceCrossVerified:consensus.priceAlignedOutcomes>0,verifiedOutcomes:consensus.verifiedOutcomes,priceAlignedOutcomes:consensus.priceAlignedOutcomes,priceDisagreementOutcomes:consensus.verifiedOutcomes-consensus.priceAlignedOutcomes,
   note:'Distinct owners corroborate market availability; independent prices must separately agree within 2 implied-probability percentage points. Neither proves executable price or EV.'};
  // Score/schedule ingestion is a separate first-party evidence plane, never bookmaker pricing.
  const scores=await db.prepare(`SELECT source_id,upstream_id,event_id,observed_at,payload
    FROM intelligence_observations WHERE observation_kind='score'
    ORDER BY observed_at DESC LIMIT ?`).bind(Math.min(limit,250)).all<Row>();
  const scoreLeagues=new Map<string,{sport:string;events:Set<string>;schedule:number;score:number;latestObservedAt:string}>();
  let malformedScores=0;
  for(const item of scores.results){
   let payload:Record<string,unknown>;
   try{payload=JSON.parse(item.payload);}catch{malformedScores++;continue;}
   if(!payload||typeof payload!=='object'||Array.isArray(payload)){malformedScores++;continue;}
   const v=(payload.value&&typeof payload.value==='object'&&!Array.isArray(payload.value)?payload.value:payload) as Record<string,unknown>;
   const sport=str(v.sport);
   if(!sport){malformedScores++;continue;}
   const recordType=v.recordType==='SCHEDULE'?'SCHEDULE':v.recordType==='SCORE'?'SCORE':'UNKNOWN';
   if(recordType==='UNKNOWN'){malformedScores++;continue;}
   let group=scoreLeagues.get(sport);
   if(!group){group={sport,events:new Set(),schedule:0,score:0,latestObservedAt:item.observed_at};scoreLeagues.set(sport,group);}
   group.events.add(item.event_id);
   if(recordType==='SCHEDULE')group.schedule++;else group.score++;
   if(Date.parse(item.observed_at)>Date.parse(group.latestObservedAt))group.latestObservedAt=item.observed_at;
  }
  const sportsObservations={classification:'SCORES_NOT_ODDS',rowsInspected:scores.results.length,
   malformedRows:malformedScores,sourceOwners:[...new Set(scores.results.map(r=>r.upstream_id))].sort(),
   sports:[...scoreLeagues.values()].map(g=>({sport:g.sport,events:g.events.size,scheduleObservations:g.schedule,scoreObservations:g.score,latestObservedAt:g.latestObservedAt})).sort((a,b)=>a.sport.localeCompare(b.sport))};
  return json({ok:true,mode:'PERSISTED_D1_ODDS',liveProviderConnected:false,sportsObservations,
   discovered:{...report.observed},leagues,providers,independentVerification,freshDraftKingsQuotes:report.observations.filter(x=>x.bookmaker.trim().toLowerCase()==='draftkings'&&x.priceAmerican!==undefined).length,
   missingMarketCount:null,missingReason:'NO_INDEPENDENT_EXPECTED_CATALOG',
   rowsInspected:records.results.length,unrecognizedRows:unrecognized,rejected:report.rejected,
   asOf:report.asOf,warning:'D1 is a persisted observation source, not proof of complete DraftKings availability.'});
 }catch{return json({ok:false,error:'COVERAGE_READ_FAILED'},503);}
}
