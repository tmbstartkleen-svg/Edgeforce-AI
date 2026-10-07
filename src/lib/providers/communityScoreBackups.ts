import type {LiveGameState} from '../liveScoreMesh';

type Cached={at:number;games:LiveGameState[]};
const cache=new Map<string,Cached>();
const inflight=new Map<string,Promise<LiveGameState[]>>();

const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const arr=(v:unknown)=>Array.isArray(v)?v:[];
const str=(v:unknown)=>typeof v==='string'?v:'';
const num=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:null};
const timeoutMs=()=>Math.max(2000,Number(process.env.COMMUNITY_SCORE_TIMEOUT_MS||6000));

function status(v:string):LiveGameState['status']{
  const s=v.toLowerCase();
  if(/final|finished|ended|complete|ft\b/.test(s))return 'FINAL';
  if(/live|in[_ -]?play|in progress|playing|halftime|quarter|period|inning|set/.test(s))return 'LIVE';
  if(/delay|postpon|suspend|cancel/.test(s))return 'DELAYED';
  if(/sched|not started|timed|pre|upcoming/.test(s))return 'SCHEDULED';
  return 'UNKNOWN';
}

async function json(url:string,headers:Record<string,string>={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs());
  try{
    const apiSports=Object.keys(headers).some(key=>key.toLowerCase()==='x-apisports-key');
    const requestHeaders=apiSports?headers:{Accept:'application/json','User-Agent':'Edgeforce-AI/144 score-mesh',...headers};
    const res=await fetch(url,{cache:'no-store',signal:controller.signal,headers:requestHeaders});
    if(!res.ok)throw new Error('HTTP '+res.status);
    return await res.json() as unknown;
  }finally{clearTimeout(timer)}
}

async function cached(key:string,ttlMs:number,load:()=>Promise<LiveGameState[]>){
  const hit=cache.get(key);
  if(hit&&Date.now()-hit.at<ttlMs)return hit.games;
  const pending=inflight.get(key);
  if(pending)return pending;
  const request=load().then(games=>{cache.set(key,{at:Date.now(),games});return games}).finally(()=>inflight.delete(key));
  inflight.set(key,request);
  return request;
}

function isoDate(offset=0){return new Date(Date.now()+offset*86400000).toISOString().slice(0,10)}

export function parseTheSportsDb(payload:unknown,sport='Multi'):LiveGameState[]{
  return arr(obj(payload).events).map(raw=>{
    const e=obj(raw);
    const state=str(e.strStatus)||str(e.strProgress)||str(e.strPostponed);
    const date=str(e.strTimestamp)||[str(e.dateEvent),str(e.strTime)].filter(Boolean).join('T');
    return {
      id:'tsdb:'+String(e.idEvent||[sport,e.strEvent,date].join(':')),
      sport:str(e.strSport)||sport,league:str(e.strLeague)||str(e.strLeagueAlternate)||sport,source:'thesportsdb',
      status:status(state||'scheduled'),detail:state,
      startTime:date||undefined,
      home:{name:str(e.strHomeTeam)||'Home',score:num(e.intHomeScore)},
      away:{name:str(e.strAwayTeam)||'Away',score:num(e.intAwayScore)},
      observedAt:new Date().toISOString()
    };
  }).filter(x=>x.home.name!=='Home'&&x.away.name!=='Away');
}

export function parseFootballData(payload:unknown):LiveGameState[]{
  return arr(obj(payload).matches).map(raw=>{
    const m=obj(raw),home=obj(m.homeTeam),away=obj(m.awayTeam),scoreNode=obj(m.score),full=obj(scoreNode.fullTime);
    const st=str(m.status);
    return {
      id:'football-data:'+String(m.id||''),
      sport:'Soccer',league:str(obj(m.competition).name)||'Soccer',source:'football-data.org',
      status:status(st),detail:st,startTime:str(m.utcDate)||undefined,
      home:{name:str(home.name)||str(home.shortName)||'Home',score:num(full.home)},
      away:{name:str(away.name)||str(away.shortName)||'Away',score:num(full.away)},
      observedAt:new Date().toISOString()
    };
  }).filter(x=>x.id!=='football-data:'&&x.home.name!=='Home'&&x.away.name!=='Away');
}

export function parseBigBalls(payload:unknown):LiveGameState[]{
  const root=obj(payload),rows=Array.isArray(root.data)?root.data:arr(obj(root.data).matches);
  return rows.map(raw=>{
    const m=obj(raw),home=obj(m.home),away=obj(m.away),scoreNode=obj(m.score||m.scores),value=obj(scoreNode.value);
    const st=str(m.status)||str(obj(m.state).status);
    const homeScore=num(scoreNode.home)??num(value.home)??num(m.home_score);
    const awayScore=num(scoreNode.away)??num(value.away)??num(m.away_score);
    return {
      id:'bigballs:'+String(m.id||m.match_id||''),
      sport:str(m.sport)||str(m.sport_key)||'Multi',
      league:str(m.league)||str(obj(m.competition).name)||'Multi',
      source:'bigballsdata',status:status(st),detail:st,
      startTime:str(m.start_time)||str(m.starts_at)||str(m.date)||undefined,
      home:{name:str(home.name)||str(m.home_name)||str(m.home_team)||'Home',score:homeScore},
      away:{name:str(away.name)||str(m.away_name)||str(m.away_team)||'Away',score:awayScore},
      observedAt:new Date().toISOString()
    };
  }).filter(x=>x.id!=='bigballs:'&&x.home.name!=='Home'&&x.away.name!=='Away');
}

export function parseApiSports(payload:unknown,source='api-sports'):LiveGameState[]{
  return arr(obj(payload).response).map(raw=>{
    const m=obj(raw),fixture=obj(m.fixture),game=obj(m.game),teams=obj(m.teams),home=obj(teams.home),away=obj(teams.away);
    const scores=obj(m.scores),goals=obj(m.goals),statusNode=obj(fixture.status||m.status||game.status);
    const st=str(statusNode.long)||str(statusNode.short)||str(m.status);
    const league=obj(m.league);
    return {
      id:source+':'+String(fixture.id||game.id||m.id||''),
      sport:str(m.sport)||str(league.type)||'Multi',
      league:str(league.name)||'Multi',source,
      status:status(st),detail:st,
      clock:statusNode.elapsed==null?undefined:String(statusNode.elapsed),
      startTime:str(fixture.date)||str(game.date)||str(m.date)||undefined,
      home:{name:str(home.name)||'Home',score:num(goals.home)??num(obj(scores.home).total)??num(m.home_score)},
      away:{name:str(away.name)||'Away',score:num(goals.away)??num(obj(scores.away).total)??num(m.away_score)},
      observedAt:new Date().toISOString()
    };
  }).filter(x=>!x.id.endsWith(':')&&x.home.name!=='Home'&&x.away.name!=='Away');
}

async function theSportsDb(){
  if(process.env.THESPORTSDB_ENABLED==='false')return [];
  const sports=(process.env.THESPORTSDB_SPORTS||'Soccer,Basketball,American Football,Baseball,Ice Hockey').split(',').map(x=>x.trim()).filter(Boolean);
  const date=isoDate();
  const batches=await Promise.allSettled(sports.map(sport=>json('https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d='+date+'&s='+encodeURIComponent(sport))));
  return batches.flatMap((r,i)=>r.status==='fulfilled'?parseTheSportsDb(r.value,sports[i]):[]);
}

async function footballData(){
  const key=process.env.FOOTBALL_DATA_API_KEY;
  if(!key)return [];
  const url='https://api.football-data.org/v4/matches?dateFrom='+isoDate(-1)+'&dateTo='+isoDate(1);
  return parseFootballData(await json(url,{'X-Auth-Token':key}));
}

async function bigBalls(){
  const key=process.env.BIGBALLS_API_KEY;
  if(!key)return [];
  const base=String(process.env.BIGBALLS_API_BASE_URL||'https://api.bigballsdata.com/v1').replace(/\/$/,'');
  return parseBigBalls(await json(base+'/matches?status=live',{Authorization:'Bearer '+key}));
}

async function apiSports(){
  const key=process.env.API_SPORTS_KEY;
  if(!key)return [];
  let endpoints:unknown=[];
  try{endpoints=JSON.parse(process.env.API_SPORTS_SCORE_ENDPOINTS_JSON||'[]')}catch{}
  if(!Array.isArray(endpoints)||!endpoints.length)return [];
  const batches=await Promise.allSettled(endpoints.slice(0,8).map(async raw=>{
    const row=obj(raw),url=str(row.url).replaceAll('{date}',isoDate());
    if(!/^https:\/\//.test(url))return [];
    return parseApiSports(await json(url,{'x-apisports-key':key}),str(row.id)||'api-sports');
  }));
  return batches.flatMap(r=>r.status==='fulfilled'?r.value:[]);
}

export async function fetchCommunityScoreBackups(){
  const sources=await Promise.allSettled([
    cached('thesportsdb',10*60_000,theSportsDb),
    cached('football-data',60_000,footballData),
    cached('bigballs',6*60_000,bigBalls),
    cached('api-sports',15*60_000,apiSports)
  ]);
  const ids=['thesportsdb','football-data.org','bigballsdata','api-sports'];
  const games:LiveGameState[]=[];
  const warnings:string[]=[];
  const sourceState=ids.map((id,i)=>{
    const result=sources[i];
    if(result.status==='fulfilled'){
      games.push(...result.value);
      return {id,ok:true,count:result.value.length};
    }
    warnings.push(id+': '+(result.reason instanceof Error?result.reason.message:'request failed'));
    return {id,ok:false,count:0};
  });
  return {games,warnings,sourceState};
}
