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


export function sharpApiProvider(
  env:Record<string,string|undefined>=process.env
):ProviderConfig|null{

  const key=env.SHARP_API_KEY?.trim();

  if(!key){
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

  const markets=[];

  for(const row of snapshot.rows){

    const item=row as Record<string,unknown>;

    markets.push({

      id:String(item.id ?? crypto.randomUUID()),

      eventId:String(
        item.eventId ??
        item.gameId ??
        ''
      ),

      sport:String(
        item.sport ??
        ''
      ),

      league:String(
        item.league ??
        ''
      ),

      home:String(
        item.home ??
        item.homeTeam ??
        ''
      ),

      away:String(
        item.away ??
        item.awayTeam ??
        ''
      ),

      market:String(
        item.market ??
        item.marketName ??
        ''
      ),

      selection:String(
        item.selection ??
        item.outcome ??
        ''
      ),

      odds:Number(
        item.odds ??
        item.price ??
        0
      ),

      bookmaker:'SharpAPI'

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
        'X-API-Key':apiKey,
        'Accept':'application/json'
      }
    }
  );


  if(!response.ok){

    throw new Error(
      `SharpAPI HTTP ${response.status}`
    );

  }


  const json =
    await response.json() as Record<string,unknown>;


  console.log(
    'SHARP KEYS',
    Object.keys(json)
  );


  let rows:unknown[]=[];


  if(Array.isArray(json.data)){
    rows=json.data;
  }
  else if(Array.isArray(json.odds)){
    rows=json.odds;
  }
  else if(Array.isArray(json.results)){
    rows=json.results;
  }
  else if(Array.isArray(json.markets)){
    rows=json.markets;
  }
  else if(Array.isArray(json.events)){
    rows=json.events;
  }


  console.log(
    'SHARP ROWS',
    rows.length
  );


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


  try{

    const snapshot =
      await fetchSharpSnapshot(
        config.apiKey ?? ''
      );


    return {

      providerId:config.id,

      providerName:config.name,

      capability:config.capability,

      receivedAt:
        new Date(started).toISOString(),

      ok:true,

      status:200,

      data:
        normalizeSharpSnapshot(snapshot),

      latencyMs:
        Date.now()-started

    };


  }catch(error){

    return {

      providerId:config.id,

      providerName:config.name,

      capability:config.capability,

      receivedAt:
        new Date(started).toISOString(),

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
