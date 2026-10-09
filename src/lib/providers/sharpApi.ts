import type {ProviderConfig,ProviderFetchResult} from './types';

const ENDPOINT='https://api.sharpapi.io/api/v1/odds';

type SharpSnapshot={
  schema:1;
  rows:unknown[];
  receivedAt:number;
  delaySeconds:number;
  pages:number;
  truncated:boolean;
};

type FlatQuote={
  id:string;
  eventId:string;
  sport:string;
  league:string;
  home:string;
  away:string;
  event:string;
  market:string;
  selection:string;
  odds:number;
  bookmaker:string;
  startTime:string;
  pulledAt:string;
  sourceDelaySeconds:number;
  sourceTimestamp:string;
  liveEligible:false;
};


const safeText=(v:unknown):string =>
  typeof v==='string' ? v : '';

const safeNumber=(v:unknown):number =>
  typeof v==='number' && Number.isFinite(v)
    ? v
    : Number(v) || 0;


export function sharpApiProvider(
  env:Record<string,string|undefined>=process.env
):ProviderConfig|null{

  const key=env.SHARP_API_KEY?.trim();

  if(
    env.SHARP_API_ENABLED!=='true' ||
    !key
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


export function normalizeSharpSnapshot(
  snapshot:SharpSnapshot
){

  const markets:FlatQuote[]=[];

  for(const row of snapshot.rows){

    const item=row as Record<string,unknown>;

    markets.push({
      id:String(item.id ?? crypto.randomUUID()),
      eventId:String(item.eventId ?? ''),
      sport:safeText(item.sport),
      league:safeText(item.league),
      home:safeText(item.home),
      away:safeText(item.away),
      event:safeText(item.event),
      market:safeText(item.market),
      selection:safeText(item.selection),
      odds:safeNumber(item.odds),
      bookmaker:'SharpAPI',
      startTime:safeText(item.startTime),
      pulledAt:new Date().toISOString(),
      sourceDelaySeconds:snapshot.delaySeconds,
      sourceTimestamp:new Date(snapshot.receivedAt).toISOString(),
      liveEligible:false
    });

  }

  return {
    markets,
    receivedRows:snapshot.rows.length,
    acceptedRows:markets.length,
    pages:snapshot.pages,
    truncated:snapshot.truncated
  };
}


export async function fetchSharpSnapshot(
  apiKey:string
):Promise<SharpSnapshot>{

  const response=await fetch(
    ENDPOINT,
    {
      headers:{
        'X-API-Key':apiKey
      }
    }
  );

  if(!response.ok){
    throw new Error(`SharpAPI HTTP ${response.status}`);
  }

  const data=await response.json() as Record<string,unknown>;

  const rows=
    Array.isArray(data.data)
      ? data.data
      : [];

  return {
    schema:1,
    rows,
    receivedAt:Date.now(),
    delaySeconds:60,
    pages:1,
    truncated:false
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

  try{

    const snapshot=await fetchSharpSnapshot(
      config.apiKey ?? ''
    );

    return {
      ...base,
      ok:true,
      status:200,
      data:normalizeSharpSnapshot(snapshot),
      latencyMs:Date.now()-started
    };

  }catch(error){

    return {
      ...base,
      ok:false,
      status:503,
      error:error instanceof Error
        ? error.message
        : 'SharpAPI failed',
      latencyMs:Date.now()-started
    };

  }
}
