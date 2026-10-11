import {createHash} from 'node:crypto';
import {db} from '../db';
import {normalizeObservation,classifyFreshness,sourceCoverage} from './agent-planner.mjs';

export type RawIntelligenceObservation={
 provider:string;upstreamId:string;eventId:string;marketId?:string;
 observedAt:number;kind:'score'|'odds'|'injury'|'lineup'|'player-stat'|'weather'|'prediction-market'|'result';
 value:unknown;
};
export type WriteReport={accepted:number;duplicates:number;rejected:number;reasons:string[]};

const MAX_BATCH=100;
const MAX_PAYLOAD_BYTES=32768;
/**
 * Append sourced observations to the EdgeForce warehouse.
 * Only registered and enabled sources can submit data; never create a
 * provider registration from an untrusted observation. Stored/demo data
 * is not reclassified as a new primary observation.
 */
export async function appendIntelligenceObservations(
 input:RawIntelligenceObservation[],now=Date.now()
):Promise<WriteReport>{
 if(!Array.isArray(input)||input.length>MAX_BATCH)
  throw new Error('INVALID_OBSERVATION_BATCH');
 const sql=db();
 if(!sql)throw new Error('DATABASE_UNAVAILABLE');
 const report:WriteReport={accepted:0,duplicates:0,rejected:0,reasons:[]};
 const registry=await sql`select source_id,upstream_id from intelligence_sources where enabled=true`;
 const authorized=new Map(registry.map(r=>[String(r.source_id),String(r.upstream_id)]));
 for(const entry of input){
  try{
   const obs=normalizeObservation(entry,now);
   if(authorized.get(obs.provider)!==obs.upstreamId)throw new Error('SOURCE_NOT_REGISTERED');
   if(classifyFreshness({observedAt:obs.observedAt,now,maxAgeMs:86400000})==='INVALID')
    throw new Error('INVALID_TIMESTAMP');
   const payload=JSON.stringify(obs.value);
   if(payload===undefined||Buffer.byteLength(payload)>MAX_PAYLOAD_BYTES)throw new Error('PAYLOAD_TOO_LARGE');
   const hash=createHash('sha256').update(payload).digest('hex');
   const rows=await sql`
    insert into intelligence_observations(
     source_id,upstream_id,event_id,market_id,observation_kind,observed_at,payload_hash,payload
    ) values(
     ${obs.provider},${obs.upstreamId},${obs.eventId},${obs.marketId},${obs.kind},
     to_timestamp(${obs.observedAt}/1000.0),${hash},${sql.json(obs.value as object)}
    )
    on conflict (source_id,event_id,observation_kind,observed_at,payload_hash)
    do nothing returning observation_id
   `;
   if(rows.length)report.accepted++;else report.duplicates++;
  }catch(error){
   report.rejected++;
   if(report.reasons.length<10)report.reasons.push(error instanceof Error?error.message:'INVALID_OBSERVATION');
  }
 }
 return report;
}

/** Read-only actionable data-quality summary, no side-effecting scans. */
export async function intelligenceCoverageHealth(now=Date.now()){
 const sql=db();
 if(!sql)return {configured:false,mode:'UNAVAILABLE'};
 const rows=await sql`
  select source_id,upstream_id,observation_kind,max(observed_at) as latest,
         count(*)::int as total
  from intelligence_observations
  group by source_id,upstream_id,observation_kind
  order by latest desc limit 100
 `;
 const sources=await sql`select source_id,upstream_id,source_type from intelligence_sources where enabled=true`;
 const coverage=sourceCoverage(sources.map(s=>({upstreamId:String(s.upstream_id)})));
 return {configured:true,mode:'READ_ONLY',generatedAt:new Date(now).toISOString(),
  ...coverage,
  observations:rows.map(r=>({sourceId:r.source_id,upstreamId:r.upstream_id,
   kind:r.observation_kind,latest:r.latest,total:r.total,
   freshness:classifyFreshness({observedAt:new Date(r.latest).getTime(),now,maxAgeMs:300000})}))
 };
}
