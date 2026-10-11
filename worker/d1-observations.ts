/**
 * Cloudflare D1 pilot writer. Explicit opt-in at the caller only; never
 * redirects existing PostgreSQL operations or triggers network collection.
 */
import {createHash} from 'node:crypto';
import {normalizeObservation} from '../src/lib/intelligence-core/agent-planner.mjs';

export type D1Statement={
 bind(...values:unknown[]):D1Statement;
 first<T=unknown>():Promise<T|null>;
 run():Promise<{meta?:{changes?:number}}>;
 all<T=unknown>():Promise<{results:T[]}>;
};
export type D1Database={prepare(query:string):D1Statement};
export type D1Observation={
 provider:string;upstreamId:string;eventId:string;marketId?:string;
 observedAt:number;
 kind:'score'|'odds'|'injury'|'lineup'|'player-stat'|'weather'|'prediction-market'|'result';
 value:unknown;
};
export type D1WriteReport={accepted:number;duplicates:number;rejected:number;reasons:string[]};

export async function appendD1Observations(
 db:D1Database,input:D1Observation[],now=Date.now()
):Promise<D1WriteReport>{
 if(!db||typeof db.prepare!=='function')throw new Error('D1_NOT_BOUND');
 if(!Array.isArray(input)||input.length>25)throw new Error('D1_BATCH_LIMIT');
 const result:D1WriteReport={accepted:0,duplicates:0,rejected:0,reasons:[]};
 for(const item of input){
  try{
   const o=normalizeObservation(item,now);
   if(now-o.observedAt>86400000)throw new Error('STALE_SOURCE_TIMESTAMP');
   const registry=await db.prepare('SELECT upstream_id FROM intelligence_sources WHERE source_id=? AND enabled=1').bind(o.provider).first<{upstream_id:string}>();
   if(!registry||registry.upstream_id!==o.upstreamId)throw new Error('D1_SOURCE_NOT_APPROVED');
   const payload=JSON.stringify(o.value);
   if(payload===undefined||new TextEncoder().encode(payload).length>32768)throw new Error('D1_PAYLOAD_TOO_LARGE');
   const hash=createHash('sha256').update(payload).digest('hex');
   const write=await db.prepare(`INSERT OR IGNORE INTO intelligence_observations
    (source_id,upstream_id,event_id,market_id,observation_kind,observed_at,payload_hash,payload)
    VALUES (?,?,?,?,?,?,?,?)`).bind(
     o.provider,o.upstreamId,o.eventId,o.marketId,o.kind,
     new Date(o.observedAt).toISOString(),hash,payload
   ).run();
   if(Number(write.meta?.changes??0)>0)result.accepted++;else result.duplicates++;
  }catch(e){
   result.rejected++;
   if(result.reasons.length<10)result.reasons.push(e instanceof Error?e.message:'D1_WRITE_FAILED');
  }
 }
 return result;
}

/** Bounded latest upstream observations; excludes the raw JSON payload by default. */
export async function readD1RecentObservations(db:D1Database,limit=50){
 if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('INVALID_D1_READ_LIMIT');
 const rows=await db.prepare(`SELECT source_id,upstream_id,event_id,market_id,
    observation_kind,observed_at,ingested_at,payload_hash
    FROM intelligence_observations ORDER BY observed_at DESC LIMIT ?`
 ).bind(limit).all();
 return rows.results;
}
