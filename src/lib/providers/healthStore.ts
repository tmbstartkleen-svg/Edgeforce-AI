import {db} from '../db';
import type {ProviderConfig,ProviderFetchResult} from './types';

export async function recordProviderResult(config:ProviderConfig,result:ProviderFetchResult<unknown>){
 const sql=db();
 if(!sql)return;
 const errorRate=result.ok?0:1;
 await sql`
  insert into provider_health(
   provider_id,name,priority,capabilities,enabled,last_success_at,last_failure_at,latency_ms,error_rate,metadata,updated_at
  ) values(
   ${config.id},${config.name},${config.priority},${sql.json([config.capability])},${config.enabled},
   ${result.ok?result.receivedAt:null},${result.ok?null:result.receivedAt},${result.latencyMs},${errorRate},
   ${sql.json({status:result.status,error:result.error||null})},now()
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
   metadata=excluded.metadata,
   updated_at=now()
 `;
}

export async function recordFailover(capability:string,fromProvider:string|null,toProvider:string|null,reason:string){
 const sql=db();
 if(!sql)return;
 await sql`insert into provider_failover_events(capability,from_provider,to_provider,reason) values(${capability},${fromProvider},${toProvider},${reason})`;
}
