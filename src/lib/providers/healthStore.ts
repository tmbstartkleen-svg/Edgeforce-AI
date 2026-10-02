import {db} from '../db';
import type {ProviderState} from '../providerRegistry';
import type {ProviderConfig,ProviderFetchResult} from './types';
import type {PayloadQuality} from './payloadQuality';

export async function loadProviderHealthStates():Promise<Map<string,ProviderState>>{
 const sql=db();
 if(!sql)return new Map();
 try{
  const rows=await sql`
   select provider_id as id,name,priority,capabilities,enabled,
    last_success_at as "lastSuccessAt",last_failure_at as "lastFailureAt",
    latency_ms::float as "latencyMs",error_rate::float as "errorRate",
    freshness_score::float as "freshnessScore",quality_score::float as "qualityScore",
    circuit_state as "circuitState",quarantined_until as "quarantinedUntil",
    consecutive_failures as "consecutiveFailures"
   from provider_health
  `;
  return new Map((rows as any[]).map(row=>[
   String(row.id),
   {
    id:String(row.id),
    name:String(row.name||row.id),
    priority:Number(row.priority||0),
    capabilities:Array.isArray(row.capabilities)?row.capabilities:[],
    enabled:Boolean(row.enabled),
    lastSuccessAt:row.lastSuccessAt?new Date(row.lastSuccessAt).toISOString():undefined,
    lastFailureAt:row.lastFailureAt?new Date(row.lastFailureAt).toISOString():undefined,
    latencyMs:row.latencyMs??undefined,
    errorRate:row.errorRate??undefined,
    freshnessScore:row.freshnessScore??undefined,
    qualityScore:row.qualityScore??undefined,
    circuitState:row.circuitState||'CLOSED',
    quarantinedUntil:row.quarantinedUntil?new Date(row.quarantinedUntil).toISOString():undefined,
    consecutiveFailures:Number(row.consecutiveFailures||0)
   } as ProviderState
  ]));
 }catch{
  return new Map();
 }
}

export async function recordProviderResult(config:ProviderConfig,result:ProviderFetchResult<unknown>,quality?:PayloadQuality){
 const sql=db();
 if(!sql)return;
 const accepted=result.ok&&quality?.ok!==false;
 const errorRate=accepted?0:1;
 const failureReason=accepted?null:(result.error||quality?.reasons.join('; ')||'provider rejected');
 const quarantineUntil=new Date(Date.now()+config.quarantineMin*60000).toISOString();
 const payloadAt=quality?.newestTimestamp||result.receivedAt;
 await sql`
  insert into provider_health(
   provider_id,name,priority,capabilities,enabled,last_success_at,last_failure_at,latency_ms,error_rate,
   metadata,updated_at,consecutive_failures,consecutive_successes,circuit_state,quarantined_until,
   freshness_score,quality_score,last_payload_at,last_failure_reason
  ) values(
   ${config.id},${config.name},${config.priority},${sql.json([config.capability])},${config.enabled},
   ${accepted?result.receivedAt:null},${accepted?null:result.receivedAt},${result.latencyMs},${errorRate},
   ${sql.json({status:result.status,error:failureReason,quality:quality||null})},now(),
   ${accepted?0:1},${accepted?1:0},
   ${!accepted&&config.failureThreshold<=1?'OPEN':'CLOSED'},
   ${!accepted&&config.failureThreshold<=1?quarantineUntil:null},
   ${quality?.freshnessScore??null},${quality?.qualityScore??null},${payloadAt},${failureReason}
  )
  on conflict (provider_id) do update set
   name=excluded.name,
   priority=excluded.priority,
   capabilities=excluded.capabilities,
   enabled=excluded.enabled,
   last_success_at=coalesce(excluded.last_success_at,provider_health.last_success_at),
   last_failure_at=coalesce(excluded.last_failure_at,provider_health.last_failure_at),
   latency_ms=(coalesce(provider_health.latency_ms,excluded.latency_ms)*0.7 + excluded.latency_ms*0.3),
   error_rate=(coalesce(provider_health.error_rate,excluded.error_rate)*0.8 + excluded.error_rate*0.2),
   consecutive_failures=case when ${accepted} then 0 else provider_health.consecutive_failures+1 end,
   consecutive_successes=case when ${accepted} then provider_health.consecutive_successes+1 else 0 end,
   circuit_state=case
    when ${accepted} then 'CLOSED'
    when provider_health.consecutive_failures+1 >= ${config.failureThreshold} then 'OPEN'
    else provider_health.circuit_state
   end,
   quarantined_until=case
    when ${accepted} then null
    when provider_health.consecutive_failures+1 >= ${config.failureThreshold} then ${quarantineUntil}::timestamptz
    else provider_health.quarantined_until
   end,
   freshness_score=coalesce(excluded.freshness_score,provider_health.freshness_score),
   quality_score=coalesce(excluded.quality_score,provider_health.quality_score),
   last_payload_at=coalesce(excluded.last_payload_at,provider_health.last_payload_at),
   last_failure_reason=case when ${accepted} then null else excluded.last_failure_reason end,
   metadata=excluded.metadata,
   updated_at=now()
 `;
 await sql`
  insert into provider_payload_audit(
   provider_id,capability,status,latency_ms,ok,error,received_at,metadata,
   row_count,payload_age_seconds,quality_score,quality_grade,rejected
  ) values(
   ${config.id},${config.capability},${result.status??null},${result.latencyMs},${result.ok},
   ${failureReason},${result.receivedAt},${sql.json({quality:quality||null})},
   ${quality?.rowCount??null},${quality?.payloadAgeMin===undefined?null:quality.payloadAgeMin*60},
   ${quality?.qualityScore??null},${quality?.grade??null},${!accepted}
  )
 `;
}

export async function recordFailover(capability:string,fromProvider:string|null,toProvider:string|null,reason:string){
 const sql=db();
 if(!sql)return;
 await sql`insert into provider_failover_events(capability,from_provider,to_provider,reason) values(${capability},${fromProvider},${toProvider},${reason})`;
}
