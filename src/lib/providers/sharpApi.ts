import type {Market} from '../types';
import {impliedProbability} from '../math';

export type SharpFetchResult={
  ok:boolean;
  markets:Market[];
  source:'SharpAPI';
  error?:string;
  rawCount:number;
  warnings:string[];
};

const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const str=(v:unknown,fallback='')=>typeof v==='string'?v:fallback;
const num=(v:unknown,fallback=0)=>typeof v==='number'&&Number.isFinite(v)?v:fallback;
const arr=(v:unknown):unknown[]=>Array.isArray(v)?v:[];
const slug=(v:string)=>v.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

function period(startTime:string):'AM'|'PM'{
  const d=new Date(startTime);
  if(Number.isNaN(d.getTime()))return 'PM';
  const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',hour12:false}).format(d));
  return hour<12?'AM':'PM';
}

function canonicalMarket(raw:string,prop=''){
  const x=(raw||prop).toLowerCase();
  if(x.includes('moneyline')||x==='h2h'||x==='ml')return 'Moneyline';
  if(x.includes('spread')||x.includes('handicap')||x.includes('run_line')||x.includes('puck_line'))return 'Spread';
  if(x.includes('total')&&!x.includes('player'))return 'Total';
  if(x.includes('player')||prop)return 'Player Prop';
  return raw||'Other';
}

function payloadRows(payload:unknown){
  if(Array.isArray(payload))return payload;
  const root=obj(payload);
  for(const key of ['data','results','odds','markets','events']){
    const value=root[key];
    if(Array.isArray(value))return value;
    const nested=obj(value);
    for(const nestedKey of ['data','results','items'])if(Array.isArray(nested[nestedKey]))return nested[nestedKey] as unknown[];
  }
  return [];
}

function flatRow(row:Record<string,unknown>,index:number,receivedAt:string):Market|null{
  const sportsbook=str(row.sportsbook,str(row.bookmaker,'draftkings'));
  if(sportsbook&&sportsbook.toLowerCase()!=='draftkings')return null;
  const odds=num(row.odds_american,num(row.american_odds,num(row.price,0)));
  const startTime=str(row.start_time,str(row.event_start_time,str(row.commence_time,'')));
  const selection=str(row.selection,str(row.outcome,str(row.name,'')));
  if(!odds||!startTime||!selection)return null;
  const sport=str(row.sport,'Unknown');
  const league=str(row.league,sport);
  const home=str(row.home_team,str(row.home,''));
  const away=str(row.away_team,str(row.away,''));
  const eventId=str(row.event_id,str(row.eventId,`${slug(league)}-${index}-${startTime}`));
  const rawMarket=str(row.market_type,str(row.market,str(row.market_key,'Moneyline')));
  const prop=str(row.prop,str(row.prop_type,str(row.stat_type,'')));
  const player=str(row.player,str(row.player_name,str(row.participant,'')));
  const pointValue=row.line??row.point??row.handicap;
  const point=typeof pointValue==='number'&&Number.isFinite(pointValue)?pointValue:undefined;
  const sourceTimestamp=str(row.timestamp,str(row.updated_at,receivedAt));
  const sourceAgeMin=Math.max(0,(Date.now()-new Date(sourceTimestamp).getTime())/60000);
  const rawProbability=num(row.probability,num(row.odds_probability,impliedProbability(odds)));
  return {
    id:str(row.id,`${eventId}:${slug(rawMarket)}:${slug(selection)}:${point??''}`),
    eventId,
    sport,
    league,
    event:str(row.event_name,str(row.event,home&&away?`${away} @ ${home}`:selection)),
    selection,
    selectionType:str(row.selection_type,''),
    market:canonicalMarket(rawMarket,prop),
    marketKey:rawMarket,
    startTime,
    home:home||'Home',
    away:away||'Away',
    odds,
    point,
    player:player||undefined,
    prop:prop||undefined,
    bookmaker:'DraftKings',
    provider:'SharpAPI',
    rawImpliedProb:rawProbability,
    marketProb:rawProbability,
    modelProb:rawProbability,
    confidence:.64,
    sourceAgeMin:Number.isFinite(sourceAgeMin)?sourceAgeMin:0,
    sourceTimestamp,
    isLive:Boolean(row.is_live),
    period:period(startTime),
    periodLabel:str(row.period,''),
    marketGroup:`${eventId}|${rawMarket}|${player}|${prop}|${point??''}`
  };
}

function groupedRow(row:Record<string,unknown>,index:number,receivedAt:string):Market[]{
  const outcomes=arr(row.outcomes);
  if(!outcomes.length)return [];
  const eventId=str(row.event_id,str(row.id,`sharp-${index}`));
  const sport=str(row.sport,'Unknown');
  const league=str(row.league,sport);
  const startTime=str(row.start_time,str(row.event_start_time,''));
  const home=str(row.home_team,str(row.home,''));
  const away=str(row.away_team,str(row.away,''));
  const rawMarket=str(row.market_type,str(row.market,'Moneyline'));
  const prop=str(row.prop,str(row.prop_type,''));
  const player=str(row.player,str(row.player_name,''));
  return outcomes.map((value,outcomeIndex)=>flatRow({
    ...obj(value),
    event_id:eventId,
    sport,
    league,
    start_time:startTime,
    home_team:home,
    away_team:away,
    event_name:str(row.event_name,str(row.event,home&&away?`${away} @ ${home}`:'')),
    market_type:rawMarket,
    prop,
    player,
    id:`${eventId}:${slug(rawMarket)}:${outcomeIndex}`
  },outcomeIndex,receivedAt)).filter((x):x is Market=>Boolean(x));
}

export function normalizeSharpPayload(payload:unknown,receivedAt=new Date().toISOString()):Market[]{
  const rows=payloadRows(payload);
  const out:Market[]=[];
  rows.forEach((value,index)=>{
    const row=obj(value);
    if(Array.isArray(row.outcomes))out.push(...groupedRow(row,index,receivedAt));
    else{
      const normalized=flatRow(row,index,receivedAt);
      if(normalized)out.push(normalized);
    }
  });
  return out;
}

export async function fetchSharpApiMarkets():Promise<SharpFetchResult>{
  const key=process.env.SHARP_API_KEY;
  if(!key)return {ok:false,markets:[],source:'SharpAPI',rawCount:0,warnings:[],error:'SHARP_API_KEY not configured'};
  const base=process.env.SHARP_API_URL||'https://api.sharpapi.io/api/v1/odds';
  const authHeader=process.env.SHARP_API_AUTH_HEADER||'X-API-Key';
  const headers:Record<string,string>={Accept:'application/json'};
  headers[authHeader]=authHeader.toLowerCase()==='authorization'?`Bearer ${key}`:key;
  const mode=(process.env.SHARP_API_LIVE_MODE||'all').toLowerCase();
  const maxPages=Math.max(1,Math.min(25,Number(process.env.SHARP_API_MAX_PAGES)||20));
  const pageLimit=Math.max(1,Math.min(200,Number(process.env.SHARP_API_LIMIT)||200));
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),Number(process.env.SHARP_API_TIMEOUT_MS)||20000);
  try{
    const markets:Market[]=[];
    const warnings:string[]=[];
    let cursor='';
    for(let page=0;page<maxPages;page++){
      const url=new URL(base);
      url.searchParams.set('sportsbook','draftkings');
      url.searchParams.set('limit',String(pageLimit));
      if(mode==='prematch')url.searchParams.set('live','false');
      if(mode==='live')url.searchParams.set('live','true');
      if(cursor)url.searchParams.set('cursor',cursor);
      const res=await fetch(url,{headers,cache:'no-store',signal:controller.signal});
      if(!res.ok){
        if(page===0)return {ok:false,markets:[],source:'SharpAPI',rawCount:0,warnings,error:`SharpAPI HTTP ${res.status}`};
        warnings.push(`SharpAPI pagination stopped at page ${page+1}: HTTP ${res.status}`);
        break;
      }
      const payload=await res.json() as unknown;
      markets.push(...normalizeSharpPayload(payload));
      const root=obj(payload),pagination=obj(root.pagination);
      const hasMore=Boolean(pagination.has_more);
      const nextCursor=str(pagination.next_cursor,'');
      if(!hasMore)break;
      if(!nextCursor){warnings.push('SharpAPI indicated more rows but did not return next_cursor');break;}
      cursor=nextCursor;
    }
    return {ok:markets.length>0,markets,source:'SharpAPI',rawCount:markets.length,warnings:markets.length?warnings:[...warnings,'SharpAPI returned no DraftKings markets']};
  }catch(error){
    return {ok:false,markets:[],source:'SharpAPI',rawCount:0,warnings:[],error:error instanceof Error?error.message:'SharpAPI request failed'};
  }finally{clearTimeout(timer)}
}
