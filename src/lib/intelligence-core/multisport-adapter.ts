import {appendIntelligenceObservations} from './warehouse';
import type {RawIntelligenceObservation} from './warehouse';

type Row=Record<string,unknown>;
const asRow=(x:unknown):Row|null=>x!==null&&typeof x==='object'&&!Array.isArray(x)?x as Row:null;
const text=(x:unknown)=>typeof x==='string'&&x.trim()?x.trim():null;
const rows=(input:unknown):unknown[]=>{
 if(Array.isArray(input))return input;
 const root=asRow(input);
 for(const key of ['data','results','events','rows','items','games','markets','players'])
  if(Array.isArray(root?.[key]))return root[key] as unknown[];
 return [];
};
export type CollectorKind='player-stat'|'score'|'prediction-market'|'result';
/** Explicit upstream observed timestamps; do not substitute local collection time. */
export function extractCollectorObservations(kind:CollectorKind,payload:unknown,provider:string,now=Date.now()):RawIntelligenceObservation[]{
 const output:RawIntelligenceObservation[]=[];
 for(const value of rows(payload).slice(0,100)){
  const x=asRow(value);if(!x)continue;
  const time=text(x.observedAt)??text(x.updatedAt)??text(x.timestamp);
  const eventId=text(x.eventId)??text(x.gameId)??text(x.fixtureId);
  const playerId=text(x.playerId)??text(x.athleteId);
  const contractId=text(x.contractId)??text(x.marketId);
  if(!eventId||!time)continue;
  if(kind==='player-stat'&&!playerId)continue;
  if(kind==='prediction-market'&&!contractId)continue;
  const observedAt=Date.parse(time);
  if(!Number.isFinite(observedAt)||observedAt>now||now-observedAt>86400000)continue;
  output.push({provider,upstreamId:provider,eventId,marketId:contractId??undefined,kind,observedAt,
   value:{...x,sourceProvider:provider}});
 }
 return output;
}
/** Collector execution uses existing authorized provider framework; this only mirrors results. */
export async function mirrorCollectorPayload(
 kind:CollectorKind,payload:unknown,provider:string|undefined,
 options:{degraded?:boolean;now?:number}={}
){
 if(process.env.INTELLIGENCE_MULTISPORT_MIRROR!=='true')return {status:'DISABLED'};
 if(!provider||options.degraded)return {status:'UNVERIFIED'};
 const batch=extractCollectorObservations(kind,payload,provider,options.now);
 if(!batch.length)return {status:'NO_ELIGIBLE_OBSERVATIONS'};
 return {status:'RECORDED',...await appendIntelligenceObservations(batch,options.now)};
}
