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
  sourceTimestamp:string;
  sourceDelaySeconds:number;
  liveEligible:false;
};

const obj=(value:unknown):Record<string,unknown>=>{
  return value && typeof value==='object' && !Array.isArray(value)
    ? value as Record<string,unknown>
    : {};
};

const text=(value:unknown,fallback=''):string=>{
  return typeof value==='string' ? value : fallback;
};

const numberValue=(value:unknown):number|null=>{
  const valueNumber=Number(value);

  return Number.isFinite(valueNumber)
    ? valueNumber
    : null;
};

function bookmakerName(value:unknown){
  const raw=text(value,'SharpAPI');
  const key=raw.trim().toLowerCase();

  if(key==='draftkings'){
    return 'DraftKings';
  }

  if(key==='fanduel'){
    return 'FanDuel';
  }

  return raw || 'SharpAPI';
}

function canonicalMarket(value:unknown){
  const market=text(value).trim().toLowerCase();

  if(
    market==='moneyline' ||
    market==='money_line'
  ){
    return 'h2h';
  }

  if(
    market==='point_spread' ||
    market==='spread' ||
    market==='spreads' ||
    market==='run_line' ||
    market==='puck_line'
  ){
    return 'spreads';
  }

  if(
    market==='total_points' ||
    market==='total_goals' ||
    market==='total_runs' ||
    market==='total' ||
    market==='totals'
  ){
    return 'totals';
  }

  return market;
}

function leagueName(item:Record<string,unknown>){
  const ref=obj(item.league_ref);

  const label=text(ref.label);

  if(label){
    return label;
  }

  const raw=text(item.league);

  const upper=raw.toUpperCase();

  const known=new Set([
    'NFL',
    'NCAAF',
    'NBA',
    'WNBA',
    'NHL',
    'MLB',
    'MLS',
    'UFC'
  ]);

  if(known.has(upper)){
    return upper;
  }

  return raw;
}

function selectionName(
  item:Record<string,unknown>,
  market:string
){
  const base=text(item.selection);

  if(!base){
    return '';
  }

  const line=numberValue(item.line);

  if(line===null){
    return base;
  }

  if(market==='spreads'){
    return `${base} ${line>0?'+':''}${line}`;
  }

  if(market==='totals'){
    return `${base} ${line}`;
  }

  return base;
}


export function sharpApiProvider(
  env:Record<string,string|undefined>=process.env
):ProviderConfig|null{

  const key=env.SHARP_API_KEY?.trim();

  if(!key){
    return null;
  }

  if(env.SHARP_API_ENABLED==='false'){
    return null;
  }

  return {
    id:'sharp-api',
    name:'SharpAPI',
    capability:'ODDS',
    url:'sharp-api://pregame-main',
    apiKey:key,
    authHeader:'X-API-Key',
    authScheme:'',
    priority:Math.max(
      1,
      Number(env.SHARP_API_PRIORITY||125)
    ),
    timeoutMs:Math.max(
      2000,
      Number(env.SHARP_API_TIMEOUT_MS||24000)
    ),
    enabled:true,
    bookmaker:'SharpAPI',
    maxAgeMin:Math.max(
      1,
      Number(env.SHARP_API_MAX_AGE_MIN||5)
    ),
    failureThreshold:3,
    quarantineMin:5,
    marketRole:'REFERENCE',
    consensusWeight:1
  };
}


export function normalizeSharpSnapshot(
  snapshot:SharpSnapshot
){

  const markets:FlatRow[]=[];
  const warnings:string[]=[];

  let rejected=0;
  let inactive=0;
  let stale=0;
  let impossible=0;

  for(
    let index=0;
    index<snapshot.rows.length;
    index++
  ){

    const item=obj(snapshot.rows[index]);

    if(item.is_impossible_scoreline===true){
      impossible++;
      continue;
    }

    if(item.is_stale_pregame_price===true){
      stale++;
      continue;
    }

    if(item.is_active===false){
      inactive++;
      continue;
    }

    const odds=numberValue(
      item.odds_american ??
      item.americanOdds ??
      item.odds ??
      item.price
    );

    const market=canonicalMarket(
      item.market_type ??
      item.market ??
      item.marketName
    );

    const home=text(
      item.home_team ??
      item.homeTeam ??
      item.home
    );

    const away=text(
      item.away_team ??
      item.awayTeam ??
      item.away
    );

    const selection=selectionName(
      item,
      market
    );

    const startTime=text(
      item.event_start_time ??
      item.startTime ??
      item.start_time ??
      item.commence_time
    );

    const timestamp=text(
      item.timestamp ??
      item.updated_at ??
      item.updatedAt
    ) || new Date(snapshot.receivedAt).toISOString();

    const league=leagueName(item);

    const sport=
      league ||
      text(item.sport,'Unknown');

    if(
      odds===null ||
      !market ||
      !selection ||
      !startTime
    ){
      rejected++;

      if(warnings.length<10){
        warnings.push(
          `SharpAPI row ${index} rejected: ` +
          `odds=${odds!==null}, ` +
          `market=${Boolean(market)}, ` +
          `selection=${Boolean(selection)}, ` +
          `startTime=${Boolean(startTime)}`
        );
      }

      continue;
    }

    markets.push({
      id:text(
        item.id,
        `sharp-${index}-${startTime}`
      ),

      eventId:text(
        item.event_id ??
        item.eventId ??
        item.event_uuid,
        `sharp-event-${index}`
      ),

      sport,

      league,

      event:
        home && away
          ? `${away} @ ${home}`
          : selection,

      home:
        home || 'Home',

      away:
        away || 'Away',

      selection,

      market,

      startTime,

      odds,

      bookmaker:
        bookmakerName(
          item.sportsbook ??
          obj(item.sportsbook_ref).label
        ),

      pulledAt:
        timestamp,

      sourceTimestamp:
        timestamp,

      sourceDelaySeconds:
        snapshot.delaySeconds,

      liveEligible:
        false
    });
  }

  if(rejected){
    warnings.push(
      `SharpAPI rejected ${rejected} structurally incomplete row(s)`
    );
  }

  if(inactive){
    warnings.push(
      `SharpAPI ignored ${inactive} inactive market row(s)`
    );
  }

  if(stale){
    warnings.push(
      `SharpAPI ignored ${stale} stale pregame price row(s)`
    );
  }

  if(impossible){
    warnings.push(
      `SharpAPI ignored ${impossible} impossible-scoreline row(s)`
    );
  }

  return {
    markets,
    warnings,
    receivedRows:snapshot.rows.length,
    acceptedRows:markets.length,
    rejectedRows:rejected,
    inactiveRows:inactive,
    staleRows:stale,
    impossibleRows:impossible,
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
      method:'GET',
      headers:{
        'X-API-Key':apiKey,
        'Accept':'application/json'
      },
      cache:'no-store'
    }
  );

  if(!response.ok){
    throw new Error(
      `SharpAPI HTTP ${response.status}`
    );
  }

  const json=
    await response.json() as Record<string,unknown>;

  const rows=
    Array.isArray(json.data)
      ? json.data
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
    receivedAt:new Date().toISOString()
  };

  try{

    const snapshot=
      await fetchSharpSnapshot(
        config.apiKey ?? ''
      );

    const normalized=
      normalizeSharpSnapshot(snapshot);

    return {
      ...base,
      ok:normalized.markets.length>0,
      status:200,
      data:normalized,
      latencyMs:Date.now()-started,
      error:normalized.markets.length
        ? undefined
        : 'SharpAPI returned no usable active markets'
    };

  }catch(error){

    return {
      ...base,
      ok:false,
      status:503,
      latencyMs:Date.now()-started,
      error:
        error instanceof Error
          ? error.message
          : 'SharpAPI request failed'
    };
  }
}
