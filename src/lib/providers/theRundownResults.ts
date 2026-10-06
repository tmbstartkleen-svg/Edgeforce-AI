import type {ProviderConfig,ProviderFetchResult} from './types';

type ResultRow={
 eventId:string;
 marketKey:'h2h'|'spreads'|'totals';
 selectionKey:string;
 result:'win'|'loss'|'push';
 settledAt:string;
};

type Cached={at:number;rows:ResultRow[];status:number;latencyMs:number};
let cache:Cached|null=null;
let inFlight:Promise<Cached>|null=null;

const BOOK_ID=String(process.env.THERUNDOWN_RESULTS_AFFILIATE_ID||'19');
const SPORT_IDS=()=>[...new Set((process.env.THERUNDOWN_RESULTS_SPORT_IDS||'1,2,3,4,5,6,7,8,10,38,39').split(',').map(x=>x.trim()).filter(x=>/^\d+$/.test(x)))];
const cacheMs=()=>Math.max(900000,Number(process.env.THERUNDOWN_RESULTS_CACHE_MS||1800000));
const timeoutMs=()=>Math.max(3000,Number(process.env.THERUNDOWN_RESULTS_TIMEOUT_MS||12000));

const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const arr=(v:unknown)=>Array.isArray(v)?v:[];
const str=(v:unknown)=>typeof v==='string'?v:'';
const numeric=(v:unknown)=>{
 const n=Number(v);
 return Number.isFinite(n)?n:null;
};
const marketName=(v:unknown)=>{
 const n=str(v).toLowerCase();
 return n==='moneyline'?'h2h':n==='spread'?'spreads':n==='total'?'totals':n;
};
function finalState(event:Record<string,unknown>){
 const candidates=[
  event.status,event.state,event.event_status,event.eventStatus,event.live_state,event.liveState,
  obj(event.status).state,obj(event.status).name,obj(event.status).description
 ].map(x=>String(x??'').toLowerCase()).join(' ');
 return /\b(final|finished|completed|complete|closed|post)\b/.test(candidates);
}
function sides(event:Record<string,unknown>){
 const teams=arr(event.teams).map(obj);
 const away=teams.find(x=>x.is_away===true)||teams[0]||{};
 const home=teams.find(x=>x.is_away===false)||teams[1]||{};
 return {away:str(away.name),home:str(home.name)};
}
function scores(event:Record<string,unknown>){
 const score=obj(event.score);
 return {
  away:numeric(score.score_away??score.away??event.away_score),
  home:numeric(score.score_home??score.home??event.home_score)
 };
}
function linePoint(line:Record<string,unknown>){
 const raw=line.value??line.line??line.spread??line.total;
 const m=String(raw??'').match(/[+-]?\d+(?:\.\d+)?/);
 return m?Number(m[0]):null;
}
function selectionName(participant:Record<string,unknown>,market:string,line:Record<string,unknown>){
 const name=str(participant.name)||String(participant.id||'');
 const point=linePoint(line);
 if(market==='spreads'&&point!==null&&!/\d/.test(name))return `${name} ${point>0?'+':''}${point}`;
 if(market==='totals'){
  const lower=(name+' '+String(line.value??'')).toLowerCase();
  const side=lower.includes('under')?'Under':lower.includes('over')?'Over':name;
  return point===null?side:`${side} ${point}`;
 }
 return name;
}
function compare(a:number,b:number):'win'|'loss'|'push'{
 return a>b?'win':a<b?'loss':'push';
}

export function normalizeTheRundownResults(payload:unknown,settledAt=new Date().toISOString()):ResultRow[]{
 const out:ResultRow[]=[];
 for(const raw of arr(obj(payload).events)){
  const event=obj(raw),eventId=str(event.event_id);
  if(!eventId||!finalState(event))continue;
  const names=sides(event),score=scores(event);
  if(!names.home||!names.away||score.home===null||score.away===null)continue;

  for(const marketRaw of arr(event.markets)){
   const marketObj=obj(marketRaw),market=marketName(marketObj.name);
   if(!['h2h','spreads','totals'].includes(market))continue;
   for(const participantRaw of arr(marketObj.participants)){
    const participant=obj(participantRaw);
    for(const lineRaw of arr(participant.lines)){
     const line=obj(lineRaw),selection=selectionName(participant,market,line);
     if(!selection)continue;
     let result:'win'|'loss'|'push'|null=null;
     if(market==='h2h'){
      if(selection.toLowerCase()===names.home.toLowerCase())result=compare(score.home,score.away);
      else if(selection.toLowerCase()===names.away.toLowerCase())result=compare(score.away,score.home);
     }else if(market==='spreads'){
      const point=linePoint(line);
      if(point===null)continue;
      const base=selection.replace(/\s+[+-]?\d+(?:\.\d+)?$/,'').trim().toLowerCase();
      if(base===names.home.toLowerCase())result=compare(score.home+point,score.away);
      else if(base===names.away.toLowerCase())result=compare(score.away+point,score.home);
     }else if(market==='totals'){
      const point=linePoint(line);
      if(point===null)continue;
      const total=score.home+score.away;
      if(/^over\b/i.test(selection))result=compare(total,point);
      else if(/^under\b/i.test(selection))result=compare(point,total);
     }
     if(result)out.push({eventId,marketKey:market as ResultRow['marketKey'],selectionKey:selection,result,settledAt});
    }
   }
  }
 }
 return out;
}

async function load(apiKey:string){
 const today=new Date();
 const dates=[new Date(today.getTime()-86400000),today].map(d=>d.toISOString().slice(0,10));
 const started=Date.now(),rows:ResultRow[]=[];
 for(const sportId of SPORT_IDS()){
  for(const date of dates){
   const url=new URL(`https://therundown.io/api/v2/sports/${sportId}/events/${date}`);
   url.searchParams.set('market_ids','1,2,3');
   url.searchParams.set('affiliate_ids',BOOK_ID);
   url.searchParams.set('main_line','true');
   url.searchParams.set('hide_closed','false');
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs());
   try{
    const res=await fetch(url,{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json','X-TheRundown-Key':apiKey,'User-Agent':'Edgeforce-AI/122 results'}});
    if(res.status===429){
     const retry=Number(res.headers.get('retry-after'));
     throw Object.assign(new Error('TheRundown results HTTP 429'),{status:429,retryAfterMs:Number.isFinite(retry)&&retry>0?retry*1000:300000});
    }
    if(res.status===401||res.status===403)throw Object.assign(new Error(`TheRundown results HTTP ${res.status}`),{status:res.status});
    if(!res.ok)continue;
    rows.push(...normalizeTheRundownResults(await res.json(),new Date().toISOString()));
   }finally{clearTimeout(timer)}
  }
 }
 return {at:Date.now(),rows,status:200,latencyMs:Date.now()-started};
}

export function theRundownResultsProvider(env:Record<string,string|undefined>=process.env):ProviderConfig|null{
 const key=env.THERUNDOWN_API_KEY?.trim();
 const enabled=env.THERUNDOWN_RESULTS_ENABLED!=='false'&&env.THERUNDOWN_ENABLED==='true';
 if(!enabled||!key||key==='[SENSITIVE]'||/[\s\u0000-\u001f\u007f]/.test(key))return null;
 return {
  id:'therundown-results',name:'TheRundown Results',capability:'RESULTS',url:'therundown://results',
  apiKey:key,authHeader:'X-TheRundown-Key',authScheme:'',priority:Math.max(1,Number(env.THERUNDOWN_RESULTS_PRIORITY||105)),
  timeoutMs:12000,enabled:true,bookmaker:'TheRundown',maxAgeMin:1440,failureThreshold:3,
  quarantineMin:Math.max(1,Number(env.THERUNDOWN_RESULTS_QUARANTINE_MIN||1)),marketRole:'REFERENCE',consensusWeight:1
 };
}

export async function fetchTheRundownResults(config:ProviderConfig):Promise<ProviderFetchResult<unknown>>{
 const started=Date.now(),apiKey=config.apiKey||'';
 const base={providerId:config.id,providerName:config.name,capability:config.capability,receivedAt:new Date().toISOString()};
 if(!apiKey)return {...base,ok:false,latencyMs:0,error:'TheRundown results key is not configured'};
 if(cache&&Date.now()-cache.at<cacheMs())return {...base,ok:true,latencyMs:0,status:cache.status,data:cache.rows};
 if(!inFlight)inFlight=load(apiKey).finally(()=>{inFlight=null});
 try{
  const result=await inFlight; cache=result;
  return {...base,ok:true,latencyMs:result.latencyMs,status:result.status,data:result.rows};
 }catch(error){
  const e=error as Error & {status?:number;retryAfterMs?:number};
  if(cache&&Date.now()-cache.at<cacheMs()*3)return {...base,ok:true,latencyMs:Date.now()-started,status:cache.status,data:cache.rows,error:'TheRundown results refresh failed; using bounded cached real results'};
  return {...base,ok:false,latencyMs:Date.now()-started,status:e.status,error:e instanceof Error?e.message:'TheRundown results request failed',retryAfterMs:e.retryAfterMs};
 }
}
