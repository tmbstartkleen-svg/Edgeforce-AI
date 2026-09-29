import type {ProviderCapability} from '../providerRegistry';
import {configuredProviders} from './config';
import {fetchProviderJson} from './http';
import {recordFailover,recordProviderResult} from './healthStore';

export type FailoverResult<T>={
 ok:boolean;
 capability:ProviderCapability;
 providerId?:string;
 providerName?:string;
 data?:T;
 attempts:Array<{providerId:string;ok:boolean;latencyMs:number;error?:string;status?:number}>;
 error?:string;
};

export async function fetchWithFailover<T=unknown>(capability:ProviderCapability):Promise<FailoverResult<T>>{
 const providers=configuredProviders(capability).sort((a,b)=>b.priority-a.priority);
 if(!providers.length)return {ok:false,capability,attempts:[],error:`No ${capability} providers configured`};
 const attempts:FailoverResult<T>['attempts']=[];
 let previous:string|null=null;
 for(const config of providers){
  const result=await fetchProviderJson<T>(config);
  await recordProviderResult(config,result as any).catch(()=>undefined);
  attempts.push({providerId:config.id,ok:result.ok,latencyMs:result.latencyMs,error:result.error,status:result.status});
  if(result.ok){
   if(previous)await recordFailover(capability,previous,config.id,'Previous provider failed').catch(()=>undefined);
   return {ok:true,capability,providerId:config.id,providerName:config.name,data:result.data,attempts};
  }
  previous=config.id;
 }
 return {ok:false,capability,attempts,error:`All ${capability} providers failed`};
}
