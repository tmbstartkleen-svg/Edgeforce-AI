import {db} from '@/lib/db';
import {providerHealth,type ProviderState} from '@/lib/providerRegistry';

export const dynamic='force-dynamic';

export async function GET(){
 const sql=db();
 if(!sql)return Response.json({source:'none',providers:[]},{headers:{'Cache-Control':'no-store'}});
 const rows=await sql`
  select provider_id as id,name,priority,capabilities,enabled,
   last_success_at as "lastSuccessAt",last_failure_at as "lastFailureAt",
   latency_ms::float as "latencyMs",error_rate::float as "errorRate",
   freshness_score::float as "freshnessScore",quality_score::float as "qualityScore",
   circuit_state as "circuitState",quarantined_until as "quarantinedUntil",
   consecutive_failures as "consecutiveFailures",consecutive_successes as "consecutiveSuccesses",
   last_payload_at as "lastPayloadAt",last_failure_reason as "lastFailureReason",updated_at as "updatedAt"
  from provider_health order by priority desc,name asc
 `;
 const providers=(rows as any[]).map(row=>{
  const state:ProviderState={
   id:String(row.id),name:String(row.name),priority:Number(row.priority||0),
   capabilities:Array.isArray(row.capabilities)?row.capabilities:[],enabled:Boolean(row.enabled),
   lastSuccessAt:row.lastSuccessAt?new Date(row.lastSuccessAt).toISOString():undefined,
   lastFailureAt:row.lastFailureAt?new Date(row.lastFailureAt).toISOString():undefined,
   latencyMs:row.latencyMs??undefined,errorRate:row.errorRate??undefined,
   freshnessScore:row.freshnessScore??undefined,qualityScore:row.qualityScore??undefined,
   circuitState:row.circuitState||'CLOSED',
   quarantinedUntil:row.quarantinedUntil?new Date(row.quarantinedUntil).toISOString():undefined,
   consecutiveFailures:Number(row.consecutiveFailures||0)
  };
  return {
   ...row,
   lastSuccessAt:state.lastSuccessAt,
   lastFailureAt:state.lastFailureAt,
   quarantinedUntil:state.quarantinedUntil,
   lastPayloadAt:row.lastPayloadAt?new Date(row.lastPayloadAt).toISOString():null,
   updatedAt:row.updatedAt?new Date(row.updatedAt).toISOString():null,
   health:providerHealth(state)
  };
 });
 return Response.json({source:'database',providers},{headers:{'Cache-Control':'no-store'}});
}
