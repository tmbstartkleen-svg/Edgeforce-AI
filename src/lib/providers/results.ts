export type CompletedEventResult={
  providerEventId:string;
  sport:string;
  commenceTime:string;
  completed:boolean;
  home:string;
  away:string;
  homeScore:number;
  awayScore:number;
  provider:string;
  sourceTimestamp:string;
  raw:unknown;
};

export type ResultFetch={
  mode:'live'|'unavailable';
  source:string|null;
  results:CompletedEventResult[];
  attempts:Array<{provider:string;ok:boolean;count:number;error?:string}>;
};

const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const str=(v:unknown,fallback='')=>typeof v==='string'?v:fallback;
const num=(v:unknown,fallback=NaN)=>{
  if(typeof v==='number'&&Number.isFinite(v))return v;
  if(typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v)))return Number(v);
  return fallback;
};
const rows=(payload:unknown)=>{
  if(Array.isArray(payload))return payload;
  const root=obj(payload);
  for(const key of ['data','results','events','scores']){
    const value=root[key];
    if(Array.isArray(value))return value;
    const nested=obj(value);
    for(const sub of ['data','results','items'])if(Array.isArray(nested[sub]))return nested[sub] as unknown[];
  }
  return [] as unknown[];
};

function scoreFromList(list:unknown,team:string){
  if(!Array.isArray(list))return NaN;
  const target=team.toLowerCase().trim();
  for(const value of list){
    const row=obj(value);
    const name=str(row.name,str(row.team,str(row.team_name,''))).toLowerCase().trim();
    if(name===target)return num(row.score,num(row.points));
  }
  return NaN;
}

export function normalizeResultPayload(payload:unknown,provider='results-provider'):CompletedEventResult[]{
  const out:CompletedEventResult[]=[];
  for(const value of rows(payload)){
    const r=obj(value);
    const providerEventId=str(r.id,str(r.event_id,str(r.eventId,'')));
    const sport=str(r.sport_title,str(r.sport,str(r.league,'')));
    const commenceTime=str(r.commence_time,str(r.start_time,str(r.startTime,'')));
    const home=str(r.home_team,str(r.home,str(r.homeTeam,'')));
    const away=str(r.away_team,str(r.away,str(r.awayTeam,'')));
    const scores=r.scores;
    const homeScore=num(r.home_score,num(r.homeScore,scoreFromList(scores,home)));
    const awayScore=num(r.away_score,num(r.awayScore,scoreFromList(scores,away)));
    const status=str(r.status).toLowerCase();
    const completed=Boolean(r.completed===true||r.final===true||status==='completed'||status==='final');
    if(!providerEventId||!home||!away||!Number.isFinite(homeScore)||!Number.isFinite(awayScore))continue;
    out.push({
      providerEventId,sport,commenceTime,completed,home,away,homeScore,awayScore,
      provider,sourceTimestamp:str(r.updated_at,str(r.last_update,new Date().toISOString())),raw:value
    });
  }
  return out;
}

async function fetchPrimary(){
  const url=process.env.RESULTS_PROVIDER_PRIMARY_URL;
  if(!url)return {ok:false,source:'Primary results',results:[] as CompletedEventResult[],error:'RESULTS_PROVIDER_PRIMARY_URL not configured'};
  const key=process.env.RESULTS_PROVIDER_PRIMARY_KEY;
  const authHeader=process.env.RESULTS_PROVIDER_PRIMARY_AUTH_HEADER||'Authorization';
  const scheme=process.env.RESULTS_PROVIDER_PRIMARY_AUTH_SCHEME||'Bearer';
  const headers:Record<string,string>={Accept:'application/json'};
  if(key)headers[authHeader]=scheme?scheme+' '+key:key;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),Number(process.env.RESULTS_PROVIDER_TIMEOUT_MS)||12000);
  try{
    const res=await fetch(url,{headers,cache:'no-store',signal:controller.signal});
    if(!res.ok)return {ok:false,source:'Primary results',results:[] as CompletedEventResult[],error:'HTTP '+res.status};
    const normalized=normalizeResultPayload(await res.json(),'Primary results').filter(x=>x.completed);
    return {ok:normalized.length>0,source:'Primary results',results:normalized,error:normalized.length?undefined:'No completed score rows'};
  }catch(error){
    return {ok:false,source:'Primary results',results:[] as CompletedEventResult[],error:error instanceof Error?error.message:'Primary results request failed'};
  }finally{clearTimeout(timer)}
}

async function fetchJson(url:URL){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),Number(process.env.THE_ODDS_API_TIMEOUT_MS)||10000);
  try{
    const res=await fetch(url,{cache:'no-store',signal:controller.signal});
    if(!res.ok)throw new Error('The Odds API HTTP '+res.status);
    return await res.json() as unknown;
  }finally{clearTimeout(timer)}
}

async function fetchOddsApiScores(){
  const key=process.env.THE_ODDS_API_KEY;
  if(!key)return {ok:false,source:'The Odds API scores',results:[] as CompletedEventResult[],error:'THE_ODDS_API_KEY not configured'};
  try{
    let sports=(process.env.THE_ODDS_API_SPORTS||'').split(',').map(x=>x.trim()).filter(Boolean);
    if(!sports.length){
      const u=new URL('https://api.the-odds-api.com/v4/sports');
      u.searchParams.set('apiKey',key);
      const payload=await fetchJson(u);
      sports=(Array.isArray(payload)?payload:[])
        .map(v=>obj(v))
        .filter(v=>v.active!==false)
        .map(v=>str(v.key))
        .filter(Boolean)
        .filter(x=>!x.includes('winner')&&!x.includes('outright'));
    }
    sports=sports.slice(0,Math.max(1,Number(process.env.RESULTS_MAX_SPORTS)||60));
    const days=Math.max(1,Math.min(3,Number(process.env.RESULTS_LOOKBACK_DAYS)||3));
    const concurrency=Math.max(1,Math.min(10,Number(process.env.THE_ODDS_API_CONCURRENCY)||5));
    const all:CompletedEventResult[]=[];
    for(let i=0;i<sports.length;i+=concurrency){
      const batch=sports.slice(i,i+concurrency);
      const fetched=await Promise.all(batch.map(async sport=>{
        const u=new URL('https://api.the-odds-api.com/v4/sports/'+sport+'/scores/');
        u.searchParams.set('apiKey',key);
        u.searchParams.set('daysFrom',String(days));
        u.searchParams.set('dateFormat','iso');
        try{return normalizeResultPayload(await fetchJson(u),'The Odds API scores').filter(x=>x.completed)}
        catch{return [] as CompletedEventResult[]}
      }));
      fetched.forEach(x=>all.push(...x));
    }
    return {ok:all.length>0,source:'The Odds API scores',results:all,error:all.length?undefined:'No completed events returned'};
  }catch(error){
    return {ok:false,source:'The Odds API scores',results:[] as CompletedEventResult[],error:error instanceof Error?error.message:'Score request failed'};
  }
}

export async function fetchCompletedResults():Promise<ResultFetch>{
  const attempts:ResultFetch['attempts']=[];
  const primary=await fetchPrimary();
  attempts.push({provider:primary.source,ok:primary.ok,count:primary.results.length,error:primary.error});
  if(primary.ok)return {mode:'live',source:primary.source,results:primary.results,attempts};
  const odds=await fetchOddsApiScores();
  attempts.push({provider:odds.source,ok:odds.ok,count:odds.results.length,error:odds.error});
  if(odds.ok)return {mode:'live',source:odds.source,results:odds.results,attempts};
  return {mode:'unavailable',source:null,results:[],attempts};
}


export type PlayerStatResult={
  providerEventId:string;
  sport:string;
  commenceTime:string;
  player:string;
  team?:string;
  stats:Record<string,number>;
  provider:string;
  sourceTimestamp:string;
  raw:unknown;
};

export type PlayerStatFetch={
  mode:'live'|'unavailable';
  source:string|null;
  results:PlayerStatResult[];
  error?:string;
};

function numericStats(value:unknown){
  const source=obj(value);
  const out:Record<string,number>={};
  for(const [k,v] of Object.entries(source)){
    const n=num(v);
    if(Number.isFinite(n))out[k]=n;
  }
  return out;
}

function playerRows(payload:unknown){
  const found:Array<{row:Record<string,unknown>;parent:Record<string,unknown>}>=[];

  const walk=(value:unknown,parent:Record<string,unknown>,depth:number)=>{
    if(depth>4)return;
    if(Array.isArray(value)){for(const item of value)walk(item,parent,depth+1);return}
    const row=obj(value);
    if(!Object.keys(row).length)return;

    const nestedPlayer=obj(row.player);
    const playerName=str(row.player_name,str(row.full_name,str(row.athlete_name,str(row.participant,str(nestedPlayer.name,str(row.name,''))))));
    const statsObj=obj(row.stats);
    const statisticsObj=obj(row.statistics);
    const playerStatsObj=obj(row.player_stats);
    const boxObj=obj(row.box_score);
    const hasStats=Object.keys(statsObj).length||Object.keys(statisticsObj).length||Object.keys(playerStatsObj).length||Object.keys(boxObj).length;
    if(playerName&&hasStats)found.push({row,parent});

    for(const key of ['players','athletes','participants','boxscore','box_score','player_stats','statistics','data','results','events','games']){
      if(row[key]!==undefined)walk(row[key],row,depth+1);
    }
  };

  walk(payload,{},0);
  return found;
}

export function normalizePlayerStatPayload(payload:unknown,provider='player-results-provider'):PlayerStatResult[]{
  const out:PlayerStatResult[]=[];
  for(const {row,parent} of playerRows(payload)){
    const nestedPlayer=obj(row.player);
    const player=str(row.player_name,str(row.full_name,str(row.athlete_name,str(row.participant,str(nestedPlayer.name,str(row.name,''))))));
    const statsSource=Object.keys(obj(row.stats)).length?row.stats:
      Object.keys(obj(row.statistics)).length?row.statistics:
      Object.keys(obj(row.player_stats)).length?row.player_stats:row.box_score;
    const stats=numericStats(statsSource);
    if(!player||!Object.keys(stats).length)continue;

    const providerEventId=str(row.event_id,str(row.eventId,str(row.game_id,str(parent.event_id,str(parent.eventId,str(parent.game_id,str(parent.id,'')))))));
    const sport=str(row.sport,str(parent.sport,str(parent.sport_title,str(parent.league,''))));
    const commenceTime=str(row.commence_time,str(row.start_time,str(row.startTime,str(parent.commence_time,str(parent.start_time,str(parent.startTime,''))))));
    const team=str(row.team_name,str(row.team,str(parent.team_name,str(parent.team,''))));
    out.push({
      providerEventId,
      sport,
      commenceTime,
      player,
      team:team||undefined,
      stats,
      provider,
      sourceTimestamp:str(row.updated_at,str(row.last_update,str(parent.updated_at,str(parent.last_update,new Date().toISOString())))),
      raw:row
    });
  }
  return out;
}

export async function fetchCompletedPlayerStats():Promise<PlayerStatFetch>{
  const url=process.env.PLAYER_RESULTS_PROVIDER_URL||process.env.STATS_PROVIDER_PRIMARY_URL;
  if(!url)return {mode:'unavailable',source:null,results:[],error:'Player result provider not configured'};

  const key=process.env.PLAYER_RESULTS_PROVIDER_KEY||process.env.STATS_PROVIDER_PRIMARY_KEY;
  const authHeader=process.env.PLAYER_RESULTS_PROVIDER_AUTH_HEADER||'Authorization';
  const scheme=process.env.PLAYER_RESULTS_PROVIDER_AUTH_SCHEME||'Bearer';
  const headers:Record<string,string>={Accept:'application/json'};
  if(key)headers[authHeader]=scheme?scheme+' '+key:key;

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),Number(process.env.PLAYER_RESULTS_PROVIDER_TIMEOUT_MS)||15000);
  try{
    const res=await fetch(url,{headers,cache:'no-store',signal:controller.signal});
    if(!res.ok)return {mode:'unavailable',source:'Player results',results:[],error:'HTTP '+res.status};
    const normalized=normalizePlayerStatPayload(await res.json(),'Player results');
    return normalized.length
      ?{mode:'live',source:'Player results',results:normalized}
      :{mode:'unavailable',source:'Player results',results:[],error:'No player stat rows returned'};
  }catch(error){
    return {mode:'unavailable',source:'Player results',results:[],error:error instanceof Error?error.message:'Player result request failed'};
  }finally{clearTimeout(timer)}
}
