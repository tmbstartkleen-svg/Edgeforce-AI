import type {ProviderConfig,ProviderFetchResult} from './types';
import {acquireSharpLease,finishSharpLease,type SharpSnapshot} from './sharedSharpFeed';

const ENDPOINT='https://api.sharpapi.io/api/v1/odds';

const BOOKS:Record<string,string>={
  draftkings:'DraftKings',
  fanduel:'FanDuel'
};

const MARKETS:Record<string,string>={
  moneyline:'h2h',
  point_spread:'spreads',
  run_line:'spreads',
  puck_line:'spreads',
  total_points:'totals',
  total_goals:'totals',
  total_runs:'totals'
};

const text=(v:unknown)=>
  typeof v==='string' &&
  v.length<=250 &&
  !/[\u0000-\u001f\u007f]/.test(v)
    ?v.trim()
    :'';

const obj=(v:unknown):Record<string,unknown>=>
  v!==null &&
  typeof v==='object' &&
  !Array.isArray(v)
    ?v as Record<string,unknown>
    :{};

const finite=(v:unknown):v is number=>
  typeof v==='number' &&
  Number.isFinite(v);

const time=(v:unknown)=>
  typeof v==='string' &&
  /(?:Z|[+-]\d{2}:\d{2})$/i.test(v)
    ?Date.parse(v)
    :NaN;


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

  if(!config.apiKey){
    return {
      providerId:config.id,
      providerName:config.name,
      capability:config.capability,
      ok:false,
      status:503,
      error:'SharpAPI key missing',
      latencyMs:Date.now()-started
    };
  }

  return {
    providerId:config.id,
    providerName:config.name,
    capability:config.capability,
    ok:false,
    status:503,
    error:'SharpAPI mapper repair in progress',
    latencyMs:Date.now()-started
  };
}
