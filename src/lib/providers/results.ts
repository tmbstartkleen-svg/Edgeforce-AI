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
    if(name===target)return num(row.score,row.points);
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
