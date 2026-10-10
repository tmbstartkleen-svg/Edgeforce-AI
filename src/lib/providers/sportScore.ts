export type SportScoreGame={
 id:string;
 sport:string;
 league:string;
 source:'sportscore';
 status:'SCHEDULED'|'LIVE'|'FINAL'|'DELAYED'|'UNKNOWN';
 detail:string;
 clock?:string;
 period?:string;
 startTime?:string;
 home:{name:string;score:number|null};
 away:{name:string;score:number|null};
 observedAt:string;
};

type CacheEntry={at:number;games:SportScoreGame[]};
const cache=new Map<string,CacheEntry>();
const inFlight=new Map<string,Promise<SportScoreGame[]>>();
const SPORTS=['football','basketball','cricket','tennis'] as const;

const cacheMs=()=>Math.max(60000,Number(process.env.SPORTSCORE_CACHE_MS||60000));
const timeoutMs=()=>Math.max(2000,Number(process.env.SPORTSCORE_TIMEOUT_MS||5000));

const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const arr=(v:unknown)=>Array.isArray(v)?v:[];
const str=(v:unknown)=>typeof v==='string'?v:'';
const score=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:null};

function statusOf(raw:string):SportScoreGame['status']{
 const v=raw.toLowerCase();
 if(/finish|final|ended|complete/.test(v))return 'FINAL';
 if(/live|progress|playing|half|quarter|period|inning|set/.test(v))return 'LIVE';
 if(/delay|postpon|suspend/.test(v))return 'DELAYED';
 if(/upcoming|scheduled|not started|pre/.test(v))return 'SCHEDULED';
 return 'UNKNOWN';
}

export function parseSportScoreMatches(payload:unknown,sport:string):SportScoreGame[]{
 const root=obj(payload);
 const observedAt=str(root.updated)||new Date().toISOString();
 return arr(root.matches).map(raw=>{
  const m=obj(raw);
  const home=str(m.home),away=str(m.away);
  const statusText=str(m.status_text)||str(m.status);
  const slug=str(m.slug);
  return {
   id:slug||[sport,away,home,str(m.time)].join(':'),
   sport:sport.toUpperCase(),
   league:sport.toUpperCase(),
   source:'sportscore' as const,
   status:statusOf(str(m.status)||statusText),
   detail:statusText,
   startTime:str(m.time)||undefined,
   home:{name:home||'Home',score:score(m.home_score)},
   away:{name:away||'Away',score:score(m.away_score)},
   observedAt
  };
 }).filter(x=>x.id&&x.home.name!=='Home'&&x.away.name!=='Away');
}

async function fetchOne(sport:string,budget?:()=>boolean){
 const hit=cache.get(sport);
 if(hit&&Date.now()-hit.at<cacheMs())return hit.games;
 const existing=inFlight.get(sport);
 if(existing)return existing;
 const request=(async()=>{
  const url=new URL('https://sportscore.com/api/widget/matches/');
  url.searchParams.set('sport',sport);
  url.searchParams.set('limit','50');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs());
  try{
   if(budget&&!budget())throw new Error('Live score request budget reached');
   const res=await fetch(url,{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json','User-Agent':'Edgeforce-AI/121 score-backup'}});
   if(!res.ok)throw new Error(`SportScore HTTP ${res.status}`);
   const games=parseSportScoreMatches(await res.json(),sport);
   cache.set(sport,{at:Date.now(),games});
   return games;
  }finally{
   clearTimeout(timer);
   inFlight.delete(sport);
  }
 })();
 inFlight.set(sport,request);
 return request;
}

export async function fetchSportScoreBackup(budget?:()=>boolean){
 if(process.env.SPORTSCORE_ENABLED!=='true'){
  return {
   enabled:false,
   games:[] as SportScoreGame[],
   attribution:{required:true,label:'Powered by SportScore',url:'https://sportscore.com/'}
  };
 }
 const settled=await Promise.allSettled(SPORTS.map(sport=>fetchOne(sport,budget)));
 const games:SportScoreGame[]=[];
 const warnings:string[]=[];
 settled.forEach((r,i)=>{
  if(r.status==='fulfilled')games.push(...r.value);
  else warnings.push(`${SPORTS[i]}: ${r.reason instanceof Error?r.reason.message:'request failed'}`);
 });
 return {
  enabled:true,
  games,
  warnings,
  attribution:{required:true,label:'Powered by SportScore',url:'https://sportscore.com/'},
  cacheMs:cacheMs()
 };
}
