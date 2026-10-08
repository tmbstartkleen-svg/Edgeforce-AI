import{t as e}from"./db-9LtqYd6N.js";async function t(){let t=e();if(!t)return new Map;try{let e=await t`
   select provider_id as id,name,priority,capabilities,enabled,
    last_success_at as "lastSuccessAt",last_failure_at as "lastFailureAt",
    latency_ms::float as "latencyMs",error_rate::float as "errorRate",
    freshness_score::float as "freshnessScore",quality_score::float as "qualityScore",
    circuit_state as "circuitState",quarantined_until as "quarantinedUntil",
    consecutive_failures as "consecutiveFailures"
   from provider_health
  `;return new Map(e.map(e=>[String(e.id),{id:String(e.id),name:String(e.name||e.id),priority:Number(e.priority||0),capabilities:Array.isArray(e.capabilities)?e.capabilities:[],enabled:!!e.enabled,lastSuccessAt:e.lastSuccessAt?new Date(e.lastSuccessAt).toISOString():void 0,lastFailureAt:e.lastFailureAt?new Date(e.lastFailureAt).toISOString():void 0,latencyMs:e.latencyMs??void 0,errorRate:e.errorRate??void 0,freshnessScore:e.freshnessScore??void 0,qualityScore:e.qualityScore??void 0,circuitState:e.circuitState||`CLOSED`,quarantinedUntil:e.quarantinedUntil?new Date(e.quarantinedUntil).toISOString():void 0,consecutiveFailures:Number(e.consecutiveFailures||0)}]))}catch{return new Map}}async function n(t,n,r){let i=e();if(!i)return;let a=n.ok&&r?.ok!==!1,o=a?0:1,s=a?null:n.error||r?.reasons.join(`; `)||`provider rejected`,c=Math.max(t.quarantineMin*6e4,n.retryAfterMs||0),l=new Date(Date.now()+c).toISOString(),u=r?.newestTimestamp||n.receivedAt;await i`
  insert into provider_health(
   provider_id,name,priority,capabilities,enabled,last_success_at,last_failure_at,latency_ms,error_rate,
   metadata,updated_at,consecutive_failures,consecutive_successes,circuit_state,quarantined_until,
   freshness_score,quality_score,last_payload_at,last_failure_reason
  ) values(
   ${t.id},${t.name},${t.priority},${i.json([t.capability])},${t.enabled},
   ${a?n.receivedAt:null},${a?null:n.receivedAt},${n.latencyMs},${o},
   ${i.json({status:n.status,error:s,quality:r||null,retryAfterMs:n.retryAfterMs??null})},now(),
   ${a?0:1},${a?1:0},
   ${!a&&t.failureThreshold<=1?`OPEN`:`CLOSED`},
   ${!a&&t.failureThreshold<=1?l:null},
   ${r?.freshnessScore??null},${r?.qualityScore??null},${u},${s}
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
   consecutive_failures=case when ${a} then 0 else provider_health.consecutive_failures+1 end,
   consecutive_successes=case when ${a} then provider_health.consecutive_successes+1 else 0 end,
   circuit_state=case
    when ${a} then 'CLOSED'
    when provider_health.consecutive_failures+1 >= ${t.failureThreshold} then 'OPEN'
    else provider_health.circuit_state
   end,
   quarantined_until=case
    when ${a} then null
    when provider_health.consecutive_failures+1 >= ${t.failureThreshold} then ${l}::timestamptz
    else provider_health.quarantined_until
   end,
   freshness_score=coalesce(excluded.freshness_score,provider_health.freshness_score),
   quality_score=coalesce(excluded.quality_score,provider_health.quality_score),
   last_payload_at=coalesce(excluded.last_payload_at,provider_health.last_payload_at),
   last_failure_reason=case when ${a} then null else excluded.last_failure_reason end,
   metadata=excluded.metadata,
   updated_at=now()
 `,await i`
  insert into provider_payload_audit(
   provider_id,capability,status,latency_ms,ok,error,received_at,metadata,
   row_count,payload_age_seconds,quality_score,quality_grade,rejected
  ) values(
   ${t.id},${t.capability},${n.status??null},${n.latencyMs},${n.ok},
   ${s},${n.receivedAt},${i.json({quality:r||null})},
   ${r?.rowCount??null},${r?.payloadAgeMin===void 0?null:r.payloadAgeMin*60},
   ${r?.qualityScore??null},${r?.grade??null},${!a}
  )
 `}async function r(t,n,r,i){let a=e();a&&await a`insert into provider_failover_events(capability,from_provider,to_provider,reason) values(${t},${n},${r},${i})`}export{r as n,n as r,t};