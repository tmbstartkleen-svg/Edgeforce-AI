import {providerHealth,type ProviderCapability,type ProviderState} from '../providerRegistry';
import {configuredProviders} from './config';
import {fetchProviderJson} from './http';
import {inspectProviderPayload,type PayloadQuality} from './payloadQuality';
import {loadProviderHealthStates,recordFailover,recordProviderResult} from './healthStore';

export type FailoverAttempt={
 providerId:string;
 ok:boolean;
 latencyMs:number;
 error?:string;
 status?:number;
 skipped?:boolean;
 circuitState?:string;
 qualityGrade?:PayloadQuality['grade'];
 qualityScore?:number;
 rowCount?:number;
 payloadAgeMin?:number;
};

export type FailoverResult<T>={
 ok:boolean;
 capability:ProviderCapability;
 providerId?:string;
 providerName?:string;
 data?:T;
 quality?:PayloadQuality;
 attempts:FailoverAttempt[];
 error?:string;
 degraded:boolean;
};

export async function fetchWithFailover<T=unknown>(
 capability:ProviderCapability,
 validate?:(data:T)=>{ok:boolean;error?:string}
):Promise<FailoverResult<T>>{
 const configured=configuredProviders(capability);
 if(!configured.length)return {ok:false,capability,attempts:[],error:`No ${capability} providers configured`,degraded:true};

 const states=await loadProviderHealthStates();
 const now=Date.now();
 const providers=[...configured].sort((a,b)=>{
  const state=(config:any):ProviderState=>states.get(config.id)||{
   id:config.id,name:config.name,priority:config.priority,capabilities:[config.capability],enabled:config.enabled,
   freshnessScore:.8,qualityScore:.8,circuitState:'CLOSED'
  };
  const ah=providerHealth(state(a),now).score;
  const bh=providerHealth(state(b),now).score;
  return (bh*1000+b.priority*2)-(ah*1000+a.priority*2);
 });

 const attempts:FailoverAttempt[]=[];
 let previous:string|null=null;
 let failureReason='No provider produced acceptable data';

 for(const config of providers){
  const stored=states.get(config.id);
  const quarantineUntil=stored?.quarantinedUntil?new Date(stored.quarantinedUntil).getTime():0;
  const quarantined=stored?.circuitState==='OPEN'&&quarantineUntil>now;
  if(quarantined){
   attempts.push({
    providerId:config.id,ok:false,latencyMs:0,skipped:true,circuitState:'OPEN',
    error:`Circuit open until ${stored?.quarantinedUntil}`
   });
   previous=config.id;
   failureReason=`Provider ${config.id} quarantined`;
   continue;
  }

  const circuitState=stored?.circuitState==='OPEN'?'HALF_OPEN':stored?.circuitState||'CLOSED';
  const raw=await fetchProviderJson<T>(config);
  let quality:PayloadQuality|undefined;
  let accepted=raw.ok;
  let error=raw.error;

  if(raw.ok){
   quality=inspectProviderPayload(raw.data,capability,config.maxAgeMin);
   accepted=quality.ok;
   if(!accepted)error=`Payload rejected: ${quality.reasons.join('; ')}`;
   if(accepted&&validate&&raw.data!==undefined){
    const validation=validate(raw.data);
    accepted=validation.ok;
    if(!accepted)error=validation.error||'Payload failed capability validation';
   }
  }

  const recorded={...raw,ok:accepted,error} as typeof raw;
  await recordProviderResult(config,recorded as any,quality).catch(()=>undefined);
  attempts.push({
   providerId:config.id,ok:accepted,latencyMs:raw.latencyMs,error,status:raw.status,circuitState,
   qualityGrade:quality?.grade,qualityScore:quality?.qualityScore,rowCount:quality?.rowCount,payloadAgeMin:quality?.payloadAgeMin
  });

  if(accepted){
   if(previous)await recordFailover(capability,previous,config.id,`Failover selected acceptable provider after prior rejection`).catch(()=>undefined);
   return {
    ok:true,capability,providerId:config.id,providerName:config.name,data:raw.data,quality,attempts,
    degraded:attempts.some(x=>!x.ok||x.skipped)||quality?.grade==='CAUTION'
   };
  }

  previous=config.id;
  failureReason=error||failureReason;
 }

 return {ok:false,capability,attempts,error:failureReason,degraded:true};
}
