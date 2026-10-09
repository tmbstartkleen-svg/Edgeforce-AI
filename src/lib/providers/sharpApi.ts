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


const text=(value:unknown):string =>
  typeof value==='string'
    ? value
    : '';

const number=(value:unknown):number =>
  typeof value==='number' && Number.isFinite(value)
    ? value
    : Number(value) || 0;


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
  const rejected:string[]=[];


  for(const row of snapshot.rows){

    const item=row as Record<string,unknown>;

    const oddsValue =
      item.odds ??
      item.price ??
      item.decimalOdds ??
      item.americanOdds ??
      item.line;


    const marketValue =
      item.market ??
      item.marketName ??
      item.type;


    if(!oddsValue || !marketValue){

      rejected.push(
        JSON.stringify({
          keys:Object.keys(item),
          sample:item
        }).slice(0,500)
      );

      continue;
    }


    markets.push({

      id:String(
        item.id ??
        crypto.randomUUID()
      ),

      eventId:String(
        item.eventId ??
        item.gameId ??
        ''
      ),

      sport:text(
        item.sport ??
        item.sportName
      ),

      league:text(
        item.league ??
        item.leagueName
      ),

      home:text(
        item.home ??
        item.homeTeam
      ),

      away:text(
        item.away ??
        item.awayTeam
      ),

      event:text(
        item.event
      ),

      market:text(
        marketValue
      ),

      selection:text(
        item.selection ??
        item.outcome ??
        item.team
      ),

      odds:number(
        oddsValue
      ),

      bookmaker:'SharpAPI',

      startTime:text(
        item.startTime ??
        item.commenceTime
      ),

      pulledAt:new Date().toISOString(),

      sourceDelaySeconds:
        snapshot.delaySeconds,

      sourceTimestamp:
        new Date(
          snapshot.receivedAt
        ).toISOString(),

      liveEligible:false

    });

  }


  return {

    markets,

    receivedRows:
      snapshot.rows.length,

    acceptedRows:
      markets.length,

    rejectedRows:
      rejected.length,

    rejectedSamples:
      rejected.slice(0,5),

    pages:
      snapshot.pages,

    truncated:
      snapshot.truncated

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

    throw new Error(
      `SharpAPI HTTP ${response.status}`
    );

  }


  const json=
    await response.json() as Record<string,unknown>;


  const rows =
    Array.isArray(json.data)
      ? json.data
      : Array.isArray(json.odds)
        ? json.odds
        : [];


  return {

    schema:1,

    rows,

    receivedAt:
      Date.now(),

    delaySeconds:
      60,

    pages:
      1,

    truncated:
      false

  };

}



export async function fetchSharpApiBoard(
  config:ProviderConfig
):Promise<ProviderFetchResult<unknown>>{


  const started=Date.now();


  const base={

    providerId:
      config.id,

    providerName:
      config.name,

    capability:
      config.capability,

    receivedAt:
      new Date(started).toISOString()

  };


  try{


    const snapshot =
      await fetchSharpSnapshot(
        config.apiKey ?? ''
      );


    return {

      ...base,

      ok:true,

      status:200,

      data:
        normalizeSharpSnapshot(
          snapshot
        ),

      latencyMs:
        Date.now()-started

    };


  }catch(error){


    return {

      ...base,

      ok:false,

      status:503,

      error:
        error instanceof Error
          ? error.message
          : 'SharpAPI failed',

      latencyMs:
        Date.now()-started

    };

  }

}
