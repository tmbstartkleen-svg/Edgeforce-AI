import type {ProviderConfig,ProviderFetchResult} from './types';
import {fetchTheOddsApiBoard} from './theOddsApi';
import {fetchSportsGameOddsBoard} from './sportsGameOdds';
import {fetchSharpApiBoard} from './sharpApi';
import {fetchPropLineBoard} from './propLine';
import {fetchOddsApi2Board} from './oddsApi2';
import {fetchTheRundownBoard} from './theRundown';
import {fetchTheRundownResults} from './theRundownResults';
import {fetchEspnCoreOdds} from './espnCoreOdds';

const untilNextMonthMs=()=>{const now=new Date();const next=Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1,0,5,0);return Math.max(3600000,next-Date.now());};

export async function fetchProviderJson<T=unknown>(config:ProviderConfig):Promise<ProviderFetchResult<T>>{
 const started=Date.now();
 if(config.url==='espn-core://odds'){
  return fetchEspnCoreOdds(config) as Promise<ProviderFetchResult<T>>;
 }
 if(config.url==='therundown://results'){
  return fetchTheRundownResults(config) as Promise<ProviderFetchResult<T>>;
 }
 if(config.url==='therundown://pregame-main'){
  return fetchTheRundownBoard(config) as Promise<ProviderFetchResult<T>>;
 }
 if(config.url==='sharp-api://pregame-main'){
  return fetchSharpApiBoard(config) as Promise<ProviderFetchResult<T>>;
 }
 if(config.url==='propline://player-props'){
  return fetchPropLineBoard(config) as Promise<ProviderFetchResult<T>>;
 }
 if(config.url==='odds-api-2://live-board'){
  return fetchOddsApi2Board(config) as Promise<ProviderFetchResult<T>>;
 }
 if(config.url==='sports-game-odds://live-board'){
  return fetchSportsGameOddsBoard(config) as Promise<ProviderFetchResult<T>>;
 }
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
   status:result.ok?200:(result.attempts.find(x=>!x.ok)?.status||502),
   data:result.data as T,
   error:[result.error,warning,quota?`quota ${quota}`:null].filter(Boolean).join(' | ')||undefined,
   retryAfterMs:result.attempts.some(x=>x.status===429)?300000:/quota has been reached|OUT_OF_USAGE_CREDITS/i.test(result.error||'')?untilNextMonthMs():undefined
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
   const retry=Number(res.headers.get('retry-after'));
   return {ok:false,providerId:config.id,providerName:config.name,capability:config.capability,latencyMs,receivedAt:new Date().toISOString(),status:res.status,error:`HTTP ${res.status}`,
    retryAfterMs:res.status===429?(Number.isFinite(retry)&&retry>0?retry*1000:300000):undefined};
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
