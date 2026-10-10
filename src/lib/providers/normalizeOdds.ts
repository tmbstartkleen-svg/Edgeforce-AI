import type {Market} from '../types';
import type {GenericEnvelope,NormalizedOddsResult} from './types';
import {impliedProbability} from '../math';

const str=(v:unknown,fallback='')=>typeof v==='string'?v:fallback;
const num=(v:unknown,fallback=0)=>typeof v==='number'&&Number.isFinite(v)?v:fallback;
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};

function rowsFromPayload(payload:unknown):unknown[]{
 if(Array.isArray(payload))return payload;
 const root=obj(payload) as GenericEnvelope;
 for(const key of ['markets','events','results','data'] as const){
  const value=root[key];
  if(Array.isArray(value))return value;
 }
 return [];
}

function normalizeFlat(row:Record<string,unknown>,receivedAt:string,index:number):Market|null{
 const odds=num(row.odds,num(row.americanOdds,num(row.price,0)));
 const home=str(row.home,str(row.homeTeam,str(row.home_team,'')));
 const away=str(row.away,str(row.awayTeam,str(row.away_team,'')));
 const selection=str(row.selection,str(row.outcome,str(row.name,'')));
 const market=str(row.market,str(row.marketKey,str(row.market_key,'Moneyline')));
 const startTime=str(row.startTime,str(row.commence_time,str(row.start_time,'')));
 if(!odds||!selection||!startTime)return null;
 const sport=str(row.sport,str(row.sportKey,str(row.sport_key,'Unknown')));
 const league=str(row.league,str(row.sportTitle,str(row.sport_title,sport)));
 const id=str(row.id,`${sport}-${index}-${startTime}`);
 const event=str(row.event,home&&away?`${away} @ ${home}`:selection);
 const providerTimestamp=str(row.sourceTimestamp,str(row.lastUpdatedAt,str(row.last_update,str(row.pulledAt,str(row.pulled_at,'')))));
 const pulled=str(row.pulledAt,str(row.pulled_at,receivedAt));
 // Use the oldest of provider event time and transport receipt time; never refresh an aging
 // price merely because a newer provider timestamp is present or the payload was fetched.
 const observedAges=[pulled,providerTimestamp].filter(Boolean).map(stamp=>(Date.now()-Date.parse(stamp))/60000);
 const sourceAgeMin=observedAges.length&&observedAges.every(Number.isFinite)?Math.max(0,...observedAges):Number.POSITIVE_INFINITY;
 const rawImpliedProb=impliedProbability(odds);
 const suppliedNoVig=num(row.noVigProbability,num(row.no_vig_probability,num(row.marketProb,num(row.impliedProbability,num(row.implied_probability,rawImpliedProb)))));
 const sourceBook=str(row.bookmaker,str(row.book,str(row.sportsbook,'')))||undefined;
 const playerName=str(row.playerName,str(row.player_name,str(row.athleteName,str(row.athlete_name,'')))).trim();
 const statKey=str(row.statKey,str(row.stat_key,market)).trim();
 return {
  id,sport,league,event,selection,market,startTime,
  home:home||'Home',away:away||'Away',odds,
  rawImpliedProb,sourceBook,
  marketProb:suppliedNoVig,
  modelProb:num(row.modelProb,suppliedNoVig),
  confidence:num(row.confidence,.6),
  sourceAgeMin:Number.isFinite(sourceAgeMin)?sourceAgeMin:Number.POSITIVE_INFINITY,
  ...(providerTimestamp?{sourceTimestamp:providerTimestamp}:{}),
  ...(row.liveEligible===false?{
   liveEligible:false,
   sourceDelaySeconds:Math.max(0,num(row.sourceDelaySeconds)),
   sourceEventId:str(row.eventId)||undefined
  }:{}),
  period:new Date(startTime).getHours()<12?'AM':'PM',
  sportFeatures:obj(row.sportFeatures) as Record<string,number>,
  ...(playerName?{playerContext:{name:playerName,statKey:statKey||undefined}}:{})
 };
}

function normalizeTheOddsEvent(row:Record<string,unknown>,receivedAt:string,eventIndex:number):Market[]{
 const sport=str(row.sport_title,str(row.sport_key,'Unknown'));
 const league=sport;
 const home=str(row.home_team,'Home');
 const away=str(row.away_team,'Away');
 const startTime=str(row.commence_time,'');
 const eventId=str(row.id,`${sport}-${eventIndex}`);
 const bookmakers=Array.isArray(row.bookmakers)?row.bookmakers:[];
 const out:Market[]=[];
 for(const bookValue of bookmakers){
  const book=obj(bookValue);
  const bookTitle=str(book.title,str(book.key,'Book'));
  const markets=Array.isArray(book.markets)?book.markets:[];
  for(const marketValue of markets){
   const marketObj=obj(marketValue);
   const marketKey=str(marketObj.key,'Moneyline');
   const outcomes=Array.isArray(marketObj.outcomes)?marketObj.outcomes:[];
   for(const outcomeValue of outcomes){
    const outcome=obj(outcomeValue);
    const odds=num(outcome.price,0);
    const playerName=str(outcome.description,'').trim();
    const outcomeName=str(outcome.name,'');
    const baseSelection=playerName?`${playerName} ${outcomeName}`:outcomeName;
    const point=num(outcome.point,Number.NaN);
    const selection=Number.isFinite(point)&&marketKey!=='h2h'
     ?`${baseSelection} ${point>0?'+':''}${point}`
     :baseSelection;
    if(!odds||!selection||!startTime)continue;
    const rawImpliedProb=impliedProbability(odds);
    out.push({
     id:`${eventId}:${marketKey}:${selection}:${bookTitle}`,
     sport,league,event:`${away} @ ${home}`,selection,market:marketKey,startTime,
     home,away,odds,rawImpliedProb,sourceBook:bookTitle,marketProb:rawImpliedProb,modelProb:rawImpliedProb,
     ...(playerName?{playerContext:{name:playerName,statKey:marketKey}}:{}),
    confidence:.6,
    sourceTimestamp:str(marketObj.last_update,str(book.last_update,''))||undefined,
    sourceAgeMin:Math.max(0,(Date.now()-new Date(str(marketObj.last_update,str(book.last_update,receivedAt))).getTime())/60000)||0,
    period:new Date(startTime).getHours()<12?'AM':'PM'
    });
   }
  }
 }
 return out;
}

function deVigCompleteMarkets(markets:Market[]){
 const groups=new Map<string,Market[]>();
 for(const row of markets){
  const line=row.playerContext?.name||/total/i.test(row.market)?row.selection.match(/(-?\d+(?:\.\d+)?)$/)?.[1]||'':'';
  const key=[row.sport,row.event,row.market,row.playerContext?.name||'',line,row.startTime,row.sourceBook||'provider'].join('|').toLowerCase();
  const group=groups.get(key)||[];
  group.push(row);
  groups.set(key,group);
 }
 for(const group of groups.values()){
  if(group.length<2||group.length>3)continue;
  const raw=group.map(x=>x.rawImpliedProb??impliedProbability(x.odds));
  const sum=raw.reduce((s,p)=>s+p,0);
  if(sum<.95||sum>1.35)continue;
  group.forEach((row,i)=>{
   row.rawImpliedProb=raw[i];
   row.marketProb=raw[i]/sum;
   if(Math.abs(row.modelProb-(row.rawImpliedProb??row.marketProb))<.000001)row.modelProb=row.marketProb;
  });
 }
 return markets;
}

export function normalizeOddsPayload(payload:unknown,receivedAt=new Date().toISOString()):NormalizedOddsResult{
 const rows=rowsFromPayload(payload);
 const markets:Market[]=[];
 const rootWarnings=obj(payload).warnings;
 const warnings:string[]=Array.isArray(rootWarnings)
  ?rootWarnings.filter((v):v is string=>typeof v==='string').slice(0,10).map(v=>v.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,500))
  :[];
 rows.forEach((value,index)=>{
  const row=obj(value);
  if(Array.isArray(row.bookmakers)){
   markets.push(...normalizeTheOddsEvent(row,receivedAt,index));
   return;
  }
  const normalized=normalizeFlat(row,receivedAt,index);
  if(normalized)markets.push(normalized);
  else warnings.push(`row ${index} could not be normalized`);
 });
 return {markets:deVigCompleteMarkets(markets),rawCount:rows.length,warnings};
}
