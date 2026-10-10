import type {ProviderConfig,ProviderFetchResult} from './types';

type FlatRow={
  id:string;
  eventId:string;
  sport:string;
  league:string;
  event:string;
  home:string;
  away:string;
  selection:string;
  market:string;
  startTime:string;
  odds:number;
  bookmaker:string;
  pulledAt:string;
};

type Cache={
  at:number;
  rows:FlatRow[];
  latencyMs:number;
  warnings:string[];
};

type SportCatalogRow={
  key?:string;
  sport_key?:string;
  active?:boolean;
  title?:string;
  name?:string;
  min_tier?:string;
};

let cache:Cache|null=null;
let inFlight:Promise<Cache>|null=null;

const obj=(value:unknown):Record<string,unknown>=>{
  return value &&
    typeof value==='object' &&
    !Array.isArray(value)
      ? value as Record<string,unknown>
      : {};
};

const arr=(value:unknown):unknown[]=>{
  return Array.isArray(value) ? value : [];
};

const str=(value:unknown,fallback=''):string=>{
  return typeof value==='string' ? value : fallback;
};

const num=(value:unknown):number|null=>{
  const n=Number(value);
  return Number.isFinite(n) ? n : null;
};

const cacheMs=()=>{
  return Math.max(
    60000,
    Number(process.env.ODDS_API_2_CACHE_MS||300000)
  );
};

const timeoutMs=()=>{
  return Math.max(
    3000,
    Number(process.env.ODDS_API_2_TIMEOUT_MS||10000)
  );
};

const baseUrl=()=>{
  return String(
    process.env.ODDS_API_2_BASE_URL ||
    'https://api.theoddsapi.com'
  ).replace(/\/$/,'');
};

const sportKeys=()=>{
  return String(
    process.env.ODDS_API_2_SPORT_KEYS ||
    'basketball_nba,baseball_mlb,americanfootball_nfl'
  )
    .split(',')
    .map(x=>x.trim())
    .filter(Boolean)
    .slice(0,12);
};

const requestedMarkets=()=>{
  return String(
    process.env.ODDS_API_2_MARKETS ||
    'h2h,spreads,totals'
  );
};

function bookmakerName(value:string){
  const key=value.trim().toLowerCase();

  const names:Record<string,string>={
    draftkings:'DraftKings',
    fanduel:'FanDuel',
    betmgm:'BetMGM',
    caesars:'Caesars',
    pinnacle:'Pinnacle',
    betfair:'Betfair'
  };

  return names[key] || value || 'Odds API 2';
}

function appendPoint(
  selection:string,
  market:string,
  outcome:Record<string,unknown>
){
  const point=num(
    outcome.point ??
    outcome.line ??
    outcome.handicap
  );

  if(point===null){
    return selection;
  }

  if(
    market==='spreads' ||
    /spread|handicap|run.?line|puck.?line/i.test(market)
  ){
    return `${selection} ${point>0?'+':''}${point}`;
  }

  if(
    market==='totals' ||
    /total|over|under/i.test(market)
  ){
    return `${selection} ${point}`;
  }

  return selection;
}

async function accessibleSports(apiKey:string,warnings:string[]){
  const url=new URL(`${baseUrl()}/sports/`);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs());

  try{
    const response=await fetch(url,{
      cache:'no-store',
      signal:controller.signal,
      headers:{
        'Accept':'application/json',
        'x-api-key':apiKey,
        'User-Agent':'EdgeForce-AI/120 Odds-API-2'
      }
    });

    if(!response.ok){
      warnings.push(`sports catalog: HTTP ${response.status}`);
      return null;
    }

    const json=await response.json();
    const catalog=arr(json).map(obj);
    const keys=catalog
      .filter(row=>row.active!==false)
      .map(row=>str(row.key??row.sport_key))
      .filter(Boolean);

    if(!keys.length){
      warnings.push('sports catalog returned no accessible sport keys');
      return null;
    }

    return new Set(keys);
  }catch(error){
    warnings.push(`sports catalog: ${error instanceof Error?error.message:'request failed'}`);
    return null;
  }finally{
    clearTimeout(timer);
  }
}

function flattenSportPayload(
  payload:unknown,
  sportKey:string
):FlatRow[]{

  const root=obj(payload);

  if(root.success===false){
    return [];
  }

  const events=arr(root.data);
  const rows:FlatRow[]=[];

  for(const eventValue of events){

    const event=obj(eventValue);

    const eventId=str(
      event.event_id ??
      event.id
    );

    const sport=str(
      event.sport,
      sportKey
    );

    const league=str(
      event.league,
      sport
    );

    const home=str(
      event.home_team
    );

    const away=str(
      event.away_team
    );

    const startTime=str(
      event.start_time ??
      event.commence_time
    );

    if(
      !eventId ||
      !home ||
      !away ||
      !startTime
    ){
      continue;
    }

    for(const bookValue of arr(event.books)){

      const book=obj(bookValue);

      const bookKey=str(
        book.book ??
        book.key ??
        book.title,
        'Odds API 2'
      );

      const bookmaker=
        bookmakerName(bookKey);

      const market=str(
        book.market ??
        book.market_key,
        'h2h'
      );

      const updatedAt=str(
        book.updated_at ??
        book.last_update,
        new Date().toISOString()
      );

      for(const outcomeValue of arr(book.outcomes)){

        const outcome=obj(outcomeValue);

        const selectionBase=str(
          outcome.name ??
          outcome.selection
        );

        const price=num(
          outcome.price ??
          outcome.odds
        );

        if(
          !selectionBase ||
          price===null ||
          price===0
        ){
          continue;
        }

        const selection=
          appendPoint(
            selectionBase,
            market,
            outcome
          );

        rows.push({
          id:[
            'oddsapi2',
            eventId,
            market,
            selection,
            bookmaker
          ].join(':'),

          eventId,
          sport,
          league,

          event:
            `${away} @ ${home}`,

          home,
          away,
          selection,
          market,
          startTime,
          odds:price,
          bookmaker,
          pulledAt:updatedAt
        });
      }
    }
  }

  return rows;
}

async function load(
  apiKey:string
):Promise<Cache>{

  const started=Date.now();

  const rows:FlatRow[]=[];
  const warnings:string[]=[];
  const requested=sportKeys();
  const accessible=await accessibleSports(apiKey,warnings);
  const selected=accessible
    ?requested.filter(key=>accessible.has(key))
    :requested;

  if(accessible){
    const blocked=requested.filter(key=>!accessible.has(key));
    if(blocked.length){
      warnings.push(`tier/access excluded sports: ${blocked.join(', ')}`);
    }
  }

  if(!selected.length){
    warnings.push('No configured Odds API 2 sports are accessible to this key');
  }

  for(const sportKey of selected){

    const url=new URL(
      `${baseUrl()}/odds/`
    );

    url.searchParams.set(
      'sport_key',
      sportKey
    );

    url.searchParams.set(
      'markets',
      requestedMarkets()
    );

    url.searchParams.set(
      'oddsFormat',
      'american'
    );

    url.searchParams.set(
      'regions',
      process.env.ODDS_API_2_REGIONS||'us'
    );

    const controller=
      new AbortController();

    const timer=setTimeout(
      ()=>controller.abort(),
      timeoutMs()
    );

    try{

      const response=await fetch(
        url,
        {
          cache:'no-store',
          signal:controller.signal,
          headers:{
            'Accept':'application/json',
            'x-api-key':apiKey,
            'User-Agent':'EdgeForce-AI/119 Odds-API-2'
          }
        }
      );

      if(!response.ok){

        const detail=
          (await response.text())
            .replace(/\s+/g,' ')
            .slice(0,300);

        warnings.push(
          `${sportKey}: HTTP ${response.status}` +
          (detail ? ` ${detail}` : '')
        );

        continue;
      }

      const json=
        await response.json();

      const root=obj(json);

      if(root.success===false){

        warnings.push(
          `${sportKey}: ${str(root.message,'API request failed')}`
        );

        continue;
      }

      rows.push(
        ...flattenSportPayload(
          json,
          sportKey
        )
      );

    }catch(error){

      warnings.push(
        `${sportKey}: ${
          error instanceof Error
            ? error.message
            : 'request failed'
        }`
      );

    }finally{

      clearTimeout(timer);

    }
  }

  warnings.unshift(`Odds API 2 requested ${requested.length} sport(s), selected ${selected.length}, accepted ${rows.length} row(s)`);

  return {
    at:Date.now(),
    rows,
    latencyMs:Date.now()-started,
    warnings
  };
}


export function oddsApi2Provider(
  env:Record<string,string|undefined>=process.env
):ProviderConfig|null{

  const key=
    env.ODDS_API_2_KEY?.trim();

  if(
    !key ||
    env.ODDS_API_2_ENABLED==='false'
  ){
    return null;
  }

  return {
    id:'odds-api-2',
    name:'Odds API 2',
    capability:'ODDS',
    url:'odds-api-2://live-board',
    apiKey:key,
    authHeader:'x-api-key',
    authScheme:'',
    priority:Math.max(
      1,
      Number(env.ODDS_API_2_PRIORITY||110)
    ),
    timeoutMs:Math.max(
      3000,
      Number(env.ODDS_API_2_TIMEOUT_MS||10000)
    ),
    enabled:true,
    bookmaker:'Odds API 2',
    maxAgeMin:Math.max(
      1,
      Number(env.ODDS_API_2_MAX_AGE_MIN||20)
    ),
    failureThreshold:3,
    quarantineMin:5,
    marketRole:'REFERENCE',
    consensusWeight:Math.max(
      .1,
      Number(env.ODDS_API_2_CONSENSUS_WEIGHT||1)
    )
  };
}


export async function fetchOddsApi2Board(
  config:ProviderConfig
):Promise<ProviderFetchResult<unknown>>{

  const base={
    providerId:config.id,
    providerName:config.name,
    capability:config.capability,
    receivedAt:new Date().toISOString()
  };

  if(
    cache &&
    Date.now()-cache.at<cacheMs()
  ){
    return {
      ...base,
      ok:cache.rows.length>0,
      status:200,
      latencyMs:0,
      data:cache.rows,
      error:cache.rows.length
        ? undefined
        : cache.warnings.join(' | ')
    };
  }

  if(!inFlight){
    inFlight=
      load(config.apiKey||'')
        .finally(()=>{
          inFlight=null;
        });
  }

  try{

    const result=await inFlight;

    cache=result;

    return {
      ...base,
      ok:result.rows.length>0,
      status:200,
      latencyMs:result.latencyMs,
      data:result.rows,
      error:result.rows.length
        ? undefined
        : result.warnings.join(' | ') ||
          'Odds API 2 returned no usable odds'
    };

  }catch(error){

    return {
      ...base,
      ok:false,
      status:503,
      latencyMs:0,
      error:
        error instanceof Error
          ? error.message
          : 'Odds API 2 request failed'
    };
  }
}
