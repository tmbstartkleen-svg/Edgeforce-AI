import type {Market} from '../types';
import {appendIntelligenceObservations} from './warehouse';

export type LiveOddsBatch={source:string;providerId?:string;markets:Market[]};

/**
 * Mirror only fresh LIVE observations emitted by an existing provider.
 * Registry must independently approve the exact provider and upstream ID.
 * Stored snapshots, demo markets and inferred timestamps never enter this feed.
 */
export async function mirrorLiveOddsToIntelligence(batch:LiveOddsBatch,now=Date.now()){
 if(process.env.INTELLIGENCE_WAREHOUSE_MIRROR_ENABLED!=='true')
  return {status:'DISABLED',accepted:0};
 if(batch.source!=='live'||!batch.providerId)
  return {status:'NOT_LIVE',accepted:0};
 const candidates=batch.markets.filter(m=>
  Boolean(m.sourceEventId&&m.sourceTimestamp&&m.sourceProviderId) &&
  Number.isFinite(new Date(m.sourceTimestamp!).getTime()) &&
  now-new Date(m.sourceTimestamp!).getTime()>=0 &&
  now-new Date(m.sourceTimestamp!).getTime()<=300000 &&
  Number.isFinite(m.odds)
 ).slice(0,100);
 if(!candidates.length)return {status:'NO_ELIGIBLE_OBSERVATIONS',accepted:0};
 const observations=candidates.map(m=>({
  provider:batch.providerId!,
  upstreamId:m.sourceProviderId!,
  eventId:m.sourceEventId!,
  marketId:m.id,
  observedAt:new Date(m.sourceTimestamp!).getTime(),
  kind:'odds' as const,
  value:{sport:m.sport,league:m.league,market:m.market,selection:m.selection,
   odds:m.odds,book:m.sourceBook??null,event:m.event,startTime:m.startTime}
 }));
 const report=await appendIntelligenceObservations(observations,now);
 return {status:'RECORDED',...report};
}
