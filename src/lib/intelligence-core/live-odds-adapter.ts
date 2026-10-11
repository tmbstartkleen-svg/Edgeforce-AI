import type {Market} from '../types';
import {appendIntelligenceObservations} from './warehouse';

export type LiveOddsBatch={source:string;providerId?:string;markets:Market[]};

/**
 * Mirror only fresh LIVE observations emitted by an existing provider.
 * Each quote retains its original configured upstream ID; batch aggregation\n * IDs must never overwrite individual quote provenance. The registry\n * independently approves the exact upstream identity.
 * Stored snapshots, demo markets and inferred timestamps never enter this feed.
 */
export async function mirrorLiveOddsToIntelligence(batch:LiveOddsBatch,now=Date.now()){
 if(process.env.INTELLIGENCE_WAREHOUSE_MIRROR_ENABLED!=='true')
  return {status:'DISABLED',accepted:0};
 if(batch.source!=='live')
  return {status:'NOT_LIVE',accepted:0};
 const diagnostic={input:batch.markets.length,missingProvenance:0,invalidTimestamp:0,
  staleTimestamp:0,invalidOdds:0,eligible:0};
 const candidates:Market[]=[];
 for(const m of batch.markets){
  if(candidates.length>=100)break;
  if(!m.sourceEventId||!m.sourceTimestamp||!m.sourceProviderId){
   diagnostic.missingProvenance++;continue;
  }
  const observedAt=Date.parse(m.sourceTimestamp);
  if(!Number.isFinite(observedAt)||observedAt>now){diagnostic.invalidTimestamp++;continue;}
  if(now-observedAt>300000){diagnostic.staleTimestamp++;continue;}
  if(!Number.isFinite(m.odds)){diagnostic.invalidOdds++;continue;}
  candidates.push(m);
 }
 diagnostic.eligible=candidates.length;
 if(!candidates.length)return {status:'NO_ELIGIBLE_OBSERVATIONS',accepted:0,diagnostic};

 const observations=candidates.map(m=>({
  provider:m.sourceProviderId!,
  upstreamId:m.sourceProviderId!,
  eventId:m.sourceEventId!,
  marketId:m.id,
  observedAt:new Date(m.sourceTimestamp!).getTime(),
  kind:'odds' as const,
  value:{sport:m.sport,league:m.league,market:m.market,selection:m.selection,
   odds:m.odds,book:m.sourceBook??null,event:m.event,startTime:m.startTime}
 }));
 const report=await appendIntelligenceObservations(observations,now);
 return {status:'RECORDED',...report,diagnostic};
}
