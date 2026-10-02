import {db} from './db';
import {configuredProviders} from './providers/config';
import {providerHealth,type ProviderState} from './providerRegistry';

export type ProviderHealthRow={
  id:string;
  name:string;
  capability:string;
  priority:number;
  enabled:boolean;
  configured:boolean;
  lastSuccessAt:string|null;
  lastFailureAt:string|null;
  latencyMs:number|null;
  errorRate:number|null;
  healthScore:number|null;
  status:'HEALTHY'|'DEGRADED'|'UNHEALTHY'|'UNKNOWN';
  stale:boolean;
};

const staleAfterMs=()=>Math.max(60000,Number(process.env.PROVIDER_HEALTH_STALE_MIN||20)*60000);

export async function getProductionProviderHealth(){
  const configured=configuredProviders();
  const sql=db();
  const healthRows=sql?await sql`
    select provider_id as id,name,priority,capabilities,enabled,last_success_at as "lastSuccessAt",
      last_failure_at as "lastFailureAt",latency_ms::float as "latencyMs",error_rate::float as "errorRate",updated_at as "updatedAt"
    from provider_health
    order by priority desc,provider_id asc
  `:[];
  const byId=new Map((healthRows as unknown as Array<any>).map(x=>[String(x.id),x]));
  const now=Date.now();

  const rows:ProviderHealthRow[]=configured.map(config=>{
    const stored=byId.get(config.id);
    const state:ProviderState={
      id:config.id,name:config.name,priority:config.priority,capabilities:[config.capability],enabled:config.enabled,
      lastSuccessAt:stored?.lastSuccessAt?String(stored.lastSuccessAt):undefined,
      lastFailureAt:stored?.lastFailureAt?String(stored.lastFailureAt):undefined,
      latencyMs:typeof stored?.latencyMs==='number'?stored.latencyMs:undefined,
      errorRate:typeof stored?.errorRate==='number'?stored.errorRate:undefined
    };
    const assessed=stored?providerHealth(state):null;
    const successMs=stored?.lastSuccessAt?new Date(stored.lastSuccessAt).getTime():NaN;
    const stale=!Number.isFinite(successMs)||now-successMs>staleAfterMs();
    return {
      id:config.id,name:config.name,capability:config.capability,priority:config.priority,enabled:config.enabled,configured:true,
      lastSuccessAt:stored?.lastSuccessAt?new Date(stored.lastSuccessAt).toISOString():null,
      lastFailureAt:stored?.lastFailureAt?new Date(stored.lastFailureAt).toISOString():null,
      latencyMs:typeof stored?.latencyMs==='number'?stored.latencyMs:null,
      errorRate:typeof stored?.errorRate==='number'?stored.errorRate:null,
      healthScore:assessed?.score??null,
      status:stored?(assessed!.status as 'HEALTHY'|'DEGRADED'|'UNHEALTHY'):'UNKNOWN',
      stale
    };
  });

  const direct=[
    {id:'sharpapi',name:'SharpAPI',capability:'ODDS',configured:Boolean(process.env.SHARP_API_KEY),priority:120},
    {id:'the-odds-api',name:'The Odds API',capability:'ODDS',configured:Boolean(process.env.THE_ODDS_API_KEY),priority:70}
  ].filter(x=>x.configured&&!rows.some(r=>r.id===x.id)).map(x=>{
    const stored=byId.get(x.id);
    const state:ProviderState={
      id:x.id,name:x.name,priority:x.priority,capabilities:['ODDS'],enabled:true,
      lastSuccessAt:stored?.lastSuccessAt?String(stored.lastSuccessAt):undefined,
      lastFailureAt:stored?.lastFailureAt?String(stored.lastFailureAt):undefined,
      latencyMs:typeof stored?.latencyMs==='number'?stored.latencyMs:undefined,
      errorRate:typeof stored?.errorRate==='number'?stored.errorRate:undefined
    };
    const assessed=stored?providerHealth(state):null;
    const successMs=stored?.lastSuccessAt?new Date(stored.lastSuccessAt).getTime():NaN;
    const stale=!Number.isFinite(successMs)||now-successMs>staleAfterMs();
    return {
      ...x,enabled:true,
      lastSuccessAt:stored?.lastSuccessAt?new Date(stored.lastSuccessAt).toISOString():null,
      lastFailureAt:stored?.lastFailureAt?new Date(stored.lastFailureAt).toISOString():null,
      latencyMs:typeof stored?.latencyMs==='number'?stored.latencyMs:null,
      errorRate:typeof stored?.errorRate==='number'?stored.errorRate:null,
      healthScore:assessed?.score??null,
      status:stored?(assessed!.status as 'HEALTHY'|'DEGRADED'|'UNHEALTHY'):'UNKNOWN' as const,
      stale
    };
  });

  const combined=[...rows,...direct];
  const counts={
    configured:combined.length,
    healthy:combined.filter(x=>x.status==='HEALTHY'&&!x.stale).length,
    degraded:combined.filter(x=>x.status==='DEGRADED'||x.stale).length,
    unhealthy:combined.filter(x=>x.status==='UNHEALTHY').length,
    unknown:combined.filter(x=>x.status==='UNKNOWN').length
  };
  return {
    databaseConfigured:Boolean(sql),
    rows:combined,
    counts,
    generatedAt:new Date().toISOString()
  };
}
