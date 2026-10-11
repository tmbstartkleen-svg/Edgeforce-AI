import type {ProviderConfig,ProviderFetchResult} from './types';

type Row={
 id:string;
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
 playerName?:string;
 statKey?:string;
};

type Cached={at:number;rows:Row[];rawCount:number;status:number;latencyMs:number};
let cache:Cached|null=null;
let inFlight:Promise<Cached>|null=null;

const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const arr=(v:unknown)=>Array.isArray(v)?v:[];
const str=(v:unknown)=>typeof v==='string'?v:'';
const entries=(v:unknown)=>Object.entries(obj(v));
const freeMode=()=>process.env.SPORTS_GAME_ODDS_FREE_MODE==='true';
// Free-mode caps are deliberately conservative: SGO meters objects/events, not just calls.
const cacheMs=()=>freeMode()?Math.max(21600000,Number(process.env.SPORTS_GAME_ODDS_CACHE_MS||21600000)):Math.max(60000,Number(process.env.SPORTS_GAME_ODDS_CACHE_MS||300000));
const timeoutMs=()=>Math.max(1000,Math.min(5500,Number(process.env.SPORTS_GAME_ODDS_TIMEOUT_MS||5500)));

function teamName(v:unknown){
 const t=obj(v),names=obj(t.names);
 return str(names.long)||str(names.medium)||str(names.short)||str(t.name)||String(t.teamID||'Unknown');
}
function american(v:unknown){
 const raw=String(v??'').trim().replace(/[^0-9+\-.]/g,'');
 const n=Number(raw);
 if(!Number.isFinite(n)||n===0)return null;
 if(Math.abs(n)>=100)return Math.round(n);
 if(n>1){
  const a=n>=2?(n-1)*100:-100/(n-1);
  return Math.round(a);
 }
 return null;
}
function selectionName(
 sideId:string,
 odd:Record<string,unknown>,
 home:Record<string,unknown>,
 away:Record<string,unknown>,
 players:Record<string,unknown>
){
 const homeId=String(home.teamID||''),awayId=String(away.teamID||'');
 if(sideId&&sideId===homeId)return teamName(home);
 if(sideId&&sideId===awayId)return teamName(away);
 if(/^home$/i.test(sideId))return teamName(home);
 if(/^away$/i.test(sideId))return teamName(away);

 const playerId=String(odd.playerID||'');
 if(playerId){
  const p=obj(players[playerId]);
  const name=str(p.name)||[str(p.firstName),str(p.lastName)].filter(Boolean).join(' ');
  if(name)return `${name}${/over|under/i.test(sideId)?' '+sideId:''}`;
 }
 if(/over/i.test(sideId))return 'Over';
 if(/under/i.test(sideId))return 'Under';
 return sideId||str(odd.marketName)||str(odd.oddID)||'Selection';
}
function appendPoint(selection:string,market:string,book:Record<string,unknown>){
 const spread=Number(book.spread),total=Number(book.overUnder);
 if(Number.isFinite(spread)&&/spread|handicap|run line|puck line/i.test(market)){
  return `${selection} ${spread>0?'+':''}${spread}`;
 }
 if(Number.isFinite(total)&&/total|over|under|^player_/i.test(market)){
  return `${selection} ${total}`;
 }
 return selection;
}
export function flattenSportsGameOdds(payload:unknown){
 const root=obj(payload);
 const events=arr(root.data??root.events??payload).map(obj);
 const rows:Row[]=[];
 const pulledAt=new Date().toISOString();
 for(const event of events){
  const eventId=String(event.eventID||event.id||'');
  const league=str(event.leagueID)||str(event.league)||'Unknown';
 
  const status=obj(event.status);
  const startTime=str(status.startsAt)||str(event.startsAt)||str(event.startTime);
  const teams=obj(event.teams),home=obj(teams.home),away=obj(teams.away),players=obj(event.players);
  const homeName=teamName(home),awayName=teamName(away);
  if(!eventId||!startTime||homeName==='Unknown'||awayName==='Unknown')continue;
  for(const [oddKey,oddValue] of entries(event.odds)){
   const odd=obj(oddValue);
   const playerId=str(odd.playerID)||oddKey.split('-')[1];
   const player=obj(players[playerId]);
   const playerName=str(player.name)||[str(player.firstName),str(player.lastName)].filter(Boolean).join(' ');
   const statKey=str(odd.statID)||oddKey.split('-')[0];
   const market=playerName?'player_'+statKey:str(odd.marketName)||str(odd.betTypeID)||'Market';
   const sideId=str(odd.sideID);
   const baseSelection=selectionName(sideId,{...odd,playerID:playerName?playerId:odd.playerID},home,away,players);
   const books=entries(odd.byBookmaker);
   if(books.length){
    for(const [bookKey,bookValue] of books){
     const book=obj(bookValue);
     if(book.available===false)continue;
     const price=american(book.odds);
     if(price===null)continue;
     const bookmaker=str(book.bookmakerID)||bookKey||'SportsGameOdds';
     rows.push({
      id:`sgo:${eventId}:${oddKey}:${bookmaker}`,
      sport:league,league,event:`${awayName} @ ${homeName}`,home:homeName,away:awayName,
      ...(playerName?{playerName,statKey}:{}),
      selection:appendPoint(baseSelection,market,book),market,startTime,odds:price,bookmaker,
      pulledAt:str(book.lastUpdatedAt)||pulledAt
     });
    }
   }else{
    const price=american(odd.bookOdds);
    if(price!==null){
     rows.push({
      id:`sgo:${eventId}:${oddKey}:consensus`,
      sport:league,league,event:`${awayName} @ ${homeName}`,home:homeName,away:awayName,
      ...(playerName?{playerName,statKey}:{}),
      selection:appendPoint(baseSelection,market,odd),market,startTime,odds:price,bookmaker:'SportsGameOdds',
      pulledAt
     });
    }
   }
  }
 }
 return {rows,rawCount:events.length};
}

async function load(apiKey:string){
 const leagues=(process.env.SPORTS_GAME_ODDS_LEAGUES||'').split(',').map(x=>x.trim()).filter(Boolean).join(',');
 const limit=freeMode()?10:Math.max(10,Math.min(250,Number(process.env.SPORTS_GAME_ODDS_EVENT_LIMIT||100)));
 const url=new URL((process.env.SPORTS_GAME_ODDS_BASE_URL||'https://api.sportsgameodds.com/v2').replace(/\/$/,'')+'/events/');
 if(leagues)url.searchParams.set('leagueID',leagues);
 url.searchParams.set('finalized','false');
 url.searchParams.set('oddsAvailable','true');
 url.searchParams.set('includeAltLines','false');
 url.searchParams.set('limit',String(limit));
 const started=Date.now();
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs());
 try{
  const res=await fetch(url,{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json','x-api-key':apiKey,'User-Agent':'Edgeforce-AI/114 provider-mesh'}});
  const latencyMs=Date.now()-started;
  if(!res.ok)throw new Error(`SportsGameOdds HTTP ${res.status}`);
  const first=await res.json();
  const parsed=flattenSportsGameOdds(first);
  let cursor=String(obj(first).nextCursor||'');
  for(let page=1;cursor&&!freeMode()&&page<3;page++){
   url.searchParams.set('cursor',cursor);
   try{
   const next=await fetch(url,{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json','x-api-key':apiKey}});
   if(!next.ok)break;
   const payload=await next.json();
   const more=flattenSportsGameOdds(payload);
   parsed.rows.push(...more.rows);parsed.rawCount+=more.rawCount;
   cursor=String(obj(payload).nextCursor||'');
   }catch{break;} // Keep successful pages when a later page times out.
  }
  return {at:Date.now(),...parsed,status:res.status,latencyMs};
 }finally{clearTimeout(timer)}
}

export async function fetchSportsGameOddsBoard(config:ProviderConfig):Promise<ProviderFetchResult<unknown>>{
 const started=Date.now();
 const apiKey=config.apiKey||process.env.SPORTS_GAME_ODDS_API_KEY||'';
 if(!apiKey){
  return {ok:false,providerId:config.id,providerName:config.name,capability:config.capability,latencyMs:0,receivedAt:new Date().toISOString(),error:'SportsGameOdds key is not configured'};
 }
 if(cache&&Date.now()-cache.at<cacheMs()){
  return {ok:cache.rows.length>0,providerId:config.id,providerName:config.name,capability:config.capability,latencyMs:0,receivedAt:new Date().toISOString(),status:cache.status,data:cache.rows,error:cache.rows.length?'':undefined};
 }
 if(!inFlight)inFlight=load(apiKey).finally(()=>{inFlight=null});
 try{
  const result=await inFlight;
  cache=result;
  return {
   ok:result.rows.length>0,
   providerId:config.id,providerName:config.name,capability:config.capability,
   latencyMs:result.latencyMs,receivedAt:new Date().toISOString(),status:result.status,data:result.rows,
   error:result.rows.length?undefined:`SportsGameOdds returned ${result.rawCount} events but no normalizable sportsbook prices`
  };
 }catch(error){
  if(cache&&Date.now()-cache.at<Math.max(cacheMs()*3,900000)){
   return {
    ok:cache.rows.length>0,providerId:config.id,providerName:config.name,capability:config.capability,
    latencyMs:Date.now()-started,receivedAt:new Date().toISOString(),status:cache.status,data:cache.rows,
    error:`SportsGameOdds refresh failed; reusing cached real rows: ${error instanceof Error?error.message:'request failed'}`
   };
  }
  return {
   ok:false,providerId:config.id,providerName:config.name,capability:config.capability,
   latencyMs:Date.now()-started,receivedAt:new Date().toISOString(),
   error:error instanceof Error?error.message:'SportsGameOdds request failed'
  };
 }
}
