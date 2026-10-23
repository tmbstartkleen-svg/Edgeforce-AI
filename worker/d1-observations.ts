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
   // Trading prices have a much shorter lifetime than scores/history.
   // Never persist future-dated odds or quotes older than fifteen minutes.
   if(o.kind==='odds'&&(o.observedAt>now||now-o.observedAt>15*60*1000))
    throw new Error('ODDS_QUOTE_TIMESTAMP_NOT_FRESH');
   const registry=await db.prepare('SELECT upstream_id,source_type FROM intelligence_sources WHERE source_id=? AND enabled=1').bind(o.provider).first<{upstream_id:string;source_type:string}>();
   if(!registry||registry.upstream_id!==o.upstreamId)throw new Error('D1_SOURCE_NOT_APPROVED');
   // A registered scoreboard, certification-only or other non-odds source
   // must never be allowed to write prices by changing its source_id prefix.
   // Explicit sportsbook-source registration is necessary, never sufficient:
   // provider storage entitlement and authenticated collection require
   // separate owner-controlled authorization before invoking this writer.
   if(o.kind==='odds'&&registry.source_type!=='sportsbook-odds')
    throw new Error('SOURCE_TYPE_NOT_AUTHORIZED_FOR_ODDS');
   // Source registration alone is not an odds entitlement. The scoreboard
   // namespace is categorically for fixture/score evidence, never prices.
   if(o.kind==='odds'&&o.provider.startsWith('espn-scoreboard-'))
    throw new Error('SCOREBOARD_SOURCE_CANNOT_SUPPLY_ODDS');
   if(o.kind==='score'&&o.provider.startsWith('espn-scoreboard-')&&o.upstreamId!=='site.api.espn.com')
    throw new Error('SCOREBOARD_UPSTREAM_MISMATCH');
   // Reject malformed sportsbook records before they can appear in coverage evidence.
   if(o.kind==='odds'){
    const q=o.value as Record<string,unknown>|null;
    const nonempty=(v:unknown)=>typeof v==='string'&&v.trim().length>0;
    if(!q||typeof q!=='object'||Array.isArray(q)||
       ![q.bookmaker,q.sport,q.league,q.marketType,q.outcomeId,q.startsAt].every(nonempty)||
       !Number.isInteger(q.priceAmerican)||Math.abs(q.priceAmerican as number)<100||
       !Number.isFinite(Date.parse(String(q.startsAt)))||Date.parse(String(q.startsAt))<=now)
      throw new Error('INVALID_ODDS_OBSERVATION');
   }
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
