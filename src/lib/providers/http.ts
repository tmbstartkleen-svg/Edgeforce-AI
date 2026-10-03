import type {ProviderConfig,ProviderFetchResult} from './types';
import {fetchTheOddsApiBoard} from './theOddsApi';

export async function fetchProviderJson<T=unknown>(config:ProviderConfig):Promise<ProviderFetchResult<T>>{
 const started=Date.now();
 if(config.url==='the-odds-api://live-board'){
  const result=await fetchTheOddsApiBoard(config);
  const quota=[
   result.quota.remaining===undefined?null:`remaining=${result.quota.remaining}`,
   result.quota.used===undefined?null:`used=${result.quota.used}`,
   result.quota.last===undefined?null:`last=${result.quota.last}`
  ].filter(Boolean).join(',');
  const warning=result.warnings[0];
  return {
   ok:result.ok,
   providerId:config.id,
   providerName:config.name,
   capability:config.capability,
   latencyMs:Date.now()-started,
   receivedAt:new Date().toISOString(),
   status:result.ok?200:502,
   data:result.data as T,
   error:[result.error,warning,quota?`quota ${quota}`:null].filter(Boolean).join(' | ')||undefined
  };
 }
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),config.timeoutMs);
 try{
  const headers:Record<string,string>={'Accept':'application/json'};
  if(config.apiKey){
   headers[config.authHeader||'Authorization']=config.authScheme
    ?`${config.authScheme} ${config.apiKey}`
    :config.apiKey;
  }
  const res=await fetch(config.url,{headers,cache:'no-store',signal:controller.signal});
  const latencyMs=Date.now()-started;
  if(!res.ok){
   return {ok:false,providerId:config.id,providerName:config.name,capability:config.capability,latencyMs,receivedAt:new Date().toISOString(),status:res.status,error:`HTTP ${res.status}`};
  }
  const data=await res.json() as T;
  return {ok:true,providerId:config.id,providerName:config.name,capability:config.capability,latencyMs,receivedAt:new Date().toISOString(),status:res.status,data};
 }catch(error){
  return {
   ok:false,
   providerId:config.id,
   providerName:config.name,
   capability:config.capability,
   latencyMs:Date.now()-started,
   receivedAt:new Date().toISOString(),
   error:error instanceof Error?error.message:'provider request failed'
  };
 }finally{
  clearTimeout(timer);
 }
}
