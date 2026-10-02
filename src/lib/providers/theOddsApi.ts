import type {Market} from '../types';
import {impliedProbability} from '../math';

export type OddsApiFetchResult={
  ok:boolean;
  markets:Market[];
  source:'The Odds API';
  sportsScanned:number;
  warnings:string[];
  error?:string;
};

type SportRow={key:string;group?:string;title?:string;active?:boolean};
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const str=(v:unknown,fallback='')=>typeof v==='string'?v:fallback;
const num=(v:unknown,fallback=0)=>typeof v==='number'&&Number.isFinite(v)?v:fallback;
const slug=(v:string)=>v.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

function period(startTime:string):'AM'|'PM'{
  const d=new Date(startTime);
  if(Number.isNaN(d.getTime()))return 'PM';
  const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',hour12:false}).format(d));
  return hour<12?'AM':'PM';
}

function marketName(key:string){
  if(key==='h2h')return 'Moneyline';
  if(key==='spreads')return 'Spread';
  if(key==='totals')return 'Total';
  return key;
}

function normalizeEvents(payload:unknown,sportKey:string):Market[]{
  if(!Array.isArray(payload))return [];
  const out:Market[]=[];
  for(const eventValue of payload){
    const event=obj(eventValue);
    const eventId=str(event.id,`${sportKey}-${out.length}`);
    const sport=str(event.sport_title,sportKey);
    const league=sport;
    const home=str(event.home_team,'Home');
    const away=str(event.away_team,'Away');
    const startTime=str(event.commence_time,'');
    for(const bookValue of Array.isArray(event.bookmakers)?event.bookmakers:[]){
      const book=obj(bookValue);
      if(str(book.key).toLowerCase()!=='draftkings'&&str(book.title).toLowerCase()!=='draftkings')continue;
      const sourceTimestamp=str(book.last_update,new Date().toISOString());
      const sourceAgeMin=Math.max(0,(Date.now()-new Date(sourceTimestamp).getTime())/60000);
      for(const marketValue of Array.isArray(book.markets)?book.markets:[]){
        const market=obj(marketValue);
        const key=str(market.key,'h2h');
        for(const outcomeValue of Array.isArray(market.outcomes)?market.outcomes:[]){
          const outcome=obj(outcomeValue);
          const odds=num(outcome.price,0);
          if(!odds||!startTime)continue;
          const name=str(outcome.name,'');
          const pointValue=outcome.point;
          const point=typeof pointValue==='number'&&Number.isFinite(pointValue)?pointValue:undefined;
          const selection=key==='totals'&&point!==undefined?`${name} ${point}`:key==='spreads'&&point!==undefined?`${name} ${point>0?'+':''}${point}`:name;
          const raw=impliedProbability(odds);
          out.push({
            id:`${eventId}:${key}:${slug(selection)}`,
            eventId,
            sport,
            league,
            event:`${away} @ ${home}`,
            selection,
            market:marketName(key),
            marketKey:key,
            startTime,
            home,
            away,
            odds,
            point,
            bookmaker:'DraftKings',
            provider:'The Odds API',
            rawImpliedProb:raw,
            marketProb:raw,
            modelProb:raw,
            confidence:.60,
            sourceAgeMin:Number.isFinite(sourceAgeMin)?sourceAgeMin:0,
            sourceTimestamp,
            period:period(startTime),
            marketGroup:`${eventId}|${key}|${key==='spreads'?Math.abs(point??0):point??''}`
          });
        }
      }
    }
  }
  return out;
}

async function fetchJson(url:URL){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),Number(process.env.THE_ODDS_API_TIMEOUT_MS)||10000);
  try{
    const res=await fetch(url,{cache:'no-store',signal:controller.signal});
    if(!res.ok)throw new Error(`The Odds API HTTP ${res.status}`);
    return await res.json() as unknown;
  }finally{clearTimeout(timer)}
}

export async function fetchTheOddsApiMarkets():Promise<OddsApiFetchResult>{
  const key=process.env.THE_ODDS_API_KEY;
  if(!key)return {ok:false,markets:[],source:'The Odds API',sportsScanned:0,warnings:[],error:'THE_ODDS_API_KEY not configured'};
  try{
    const sportsUrl=new URL('https://api.the-odds-api.com/v4/sports');
    sportsUrl.searchParams.set('apiKey',key);
    const sportsPayload=await fetchJson(sportsUrl);
    const sports=(Array.isArray(sportsPayload)?sportsPayload:[])
      .map(value=>obj(value) as unknown as SportRow)
      .filter(x=>x.key&&x.active!==false)
      .filter(x=>!x.key.includes('winner')&&!x.key.includes('outright'));
    const allow=(process.env.THE_ODDS_API_SPORTS||'').split(',').map(x=>x.trim()).filter(Boolean);
    const selected=(allow.length?sports.filter(x=>allow.includes(x.key)):sports).slice(0,Math.max(1,Number(process.env.THE_ODDS_API_MAX_SPORTS)||80));
    const all:Market[]=[];
    const warnings:string[]=[];
    const concurrency=Math.max(1,Math.min(10,Number(process.env.THE_ODDS_API_CONCURRENCY)||5));
    for(let i=0;i<selected.length;i+=concurrency){
      const batch=selected.slice(i,i+concurrency);
      const results=await Promise.all(batch.map(async sport=>{
        const url=new URL(`https://api.the-odds-api.com/v4/sports/${sport.key}/odds`);
        url.searchParams.set('apiKey',key);
        url.searchParams.set('bookmakers','draftkings');
        url.searchParams.set('markets','h2h,spreads,totals');
        url.searchParams.set('oddsFormat','american');
        url.searchParams.set('dateFormat','iso');
        try{return {sport:sport.key,payload:await fetchJson(url)};}catch(error){return {sport:sport.key,error:error instanceof Error?error.message:'request failed'};}
      }));
      for(const result of results){
        if('error' in result&&result.error){warnings.push(`${result.sport}: ${result.error}`);continue;}
        all.push(...normalizeEvents(result.payload,result.sport));
      }
    }
    return {ok:all.length>0,markets:all,source:'The Odds API',sportsScanned:selected.length,warnings,error:all.length?undefined:'No DraftKings featured markets returned'};
  }catch(error){
    return {ok:false,markets:[],source:'The Odds API',sportsScanned:0,warnings:[],error:error instanceof Error?error.message:'The Odds API request failed'};
  }
}
