import type {ProviderConfig,ProviderFetchResult} from './types';
import {acquireSharpLease,finishSharpLease,type SharpSnapshot} from './sharedSharpFeed';

const ENDPOINT='https://api.sharpapi.io/api/v1/odds';


export function sharpApiProvider(
  env:Record<string,string|undefined>=process.env
):ProviderConfig|null{

  const key=env.SHARP_API_KEY?.trim();

  if(
    env.SHARP_API_ENABLED!=='true' ||
    !key ||
    key==='[SENSITIVE]'
  ){
    return null;
  }

  return {
    id:'sharp-api',
    name:'SharpAPI (delayed pregame)',
    capability:'ODDS',
    url:'sharp-api://pregame-main',
    apiKey:key,
    authHeader:'X-API-Key',
    authScheme:'',
    priority:125,
    timeoutMs:24000,
    enabled:true,
    bookmaker:'SharpAPI',
    maxAgeMin:5,
    failureThreshold:3,
    quarantineMin:5,
    marketRole:'REFERENCE',
    consensusWeight:1
  };
}


export async function fetchSharpApiBoard(
  config:ProviderConfig
):Promise<ProviderFetchResult<unknown>>{

  const started=Date.now();

  const base={
    providerId:config.id,
    providerName:config.name,
    capability:config.capability,
    receivedAt:new Date(started).toISOString()
  };


  if(!config.apiKey){
    return {
      ...base,
      ok:false,
      status:503,
      error:'SharpAPI key missing',
      latencyMs:Date.now()-started
    };
  }


  let lease;

  try{
    lease=await acquireSharpLease(config.apiKey);
  }
  catch{
    return {
      ...base,
      ok:false,
      status:503,
      error:'SharpAPI shared request budget unavailable; no upstream request made',
      latencyMs:Date.now()-started
    };
  }


  if(lease.kind==='hold'){
    return {
      ...base,
      ok:false,
      status:429,
      error:`SharpAPI shared budget is cooling down; retry after ${Math.ceil(lease.retryAfterMs/1000)}s`,
      latencyMs:Date.now()-started
    };
  }


  if(lease.kind==='cached'){
    return {
      ...base,
      ok:true,
      status:200,
      data:lease.snapshot,
      latencyMs:Date.now()-started
    };
  }


  try{

    const snapshot:SharpSnapshot={
      schema:1,
      rows:[],
      receivedAt:Date.now(),
      delaySeconds:60,
      pages:0,
      truncated:false
    };


    await finishSharpLease(
      lease,
      snapshot
    );


    return {
      ...base,
      ok:false,
      status:503,
      error:'SharpAPI mapper repair in progress',
      latencyMs:Date.now()-started
    };

  }
  catch{

    return {
      ...base,
      ok:false,
      status:503,
      error:'SharpAPI refresh failed',
      latencyMs:Date.now()-started
    };

  }
}
