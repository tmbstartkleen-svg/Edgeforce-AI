import type {ProviderConfig,ProviderFetchResult} from './types';

type Row={
 id:string; sport:string; league:string; event:string; home:string; away:string;
 selection:string; market:string; startTime:string; odds:number; bookmaker:string; pulledAt:string;
 sourceDelaySeconds:number; liveEligible:false;
};
type Cached={at:number;rows:Row[];status:number;latencyMs:number;quota:string[]};
let cache:Cached|null=null;
let inFlight:Promise<Cached>|null=null;

const BOOKS:Record<string,string>={'19':'DraftKings','22':'BetMGM','23':'FanDuel'};
const SPORT_LABELS:Record<string,string>={
 '1':'NCAAF','2':'NFL','3':'MLB','4':'NBA','5':'NCAAB','6':'NHL','7':'UFC','8':'WNBA',
 '10':'MLS','11':'EPL','12':'Ligue 1','13':'Bundesliga','14':'LaLiga','15':'Serie A','16':'UCL',
 '38':'ATP','39':'WTA'
};
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const arr=(v:unknown)=>Array.isArray(v)?v:[];
const str=(v:unknown)=>typeof v==='string'?v:'';
const finite=(v:unknown)=>typeof v==='number'&&Number.isFinite(v);
const cacheMs=()=>Math.max(300000,Number(process.env.THERUNDOWN_CACHE_MS||1800000));
const timeoutMs=()=>Math.max(3000,Number(process.env.THERUNDOWN_TIMEOUT_MS||12000));
const sportIds=()=>[...new Set((process.env.THERUNDOWN_SPORT_IDS||'1,2,3,4,5,6,7,8,10,11,12,13,14,15,16,38,39').split(',').map(x=>x.trim()).filter(x=>/^\d+$/.test(x)))];
const rotatingSportIds=()=>{
 const ids=sportIds(),width=Math.max(1,Math.min(8,Number(process.env.THERUNDOWN_SPORTS_PER_BATCH||4)));
 if(ids.length<=width)return ids;
 const bucket=Math.floor(Date.now()/cacheMs()),start=(bucket*width)%ids.length;
 return Array.from({length:Math.min(width,ids.length)},(_,i)=>ids[(start+i)%ids.length]);
};
const marketName=(v:unknown)=>{const n=str(v).toLowerCase();return n==='moneyline'?'h2h':n==='spread'?'spreads':n==='total'?'totals':n||'market'};
const numeric=(v:unknown)=>{
 if(typeof v==='number'&&Number.isFinite(v))return v;
 const m=String(v??'').match(/[+-]?\d+(?:\.\d+)?/);
 return m?Number(m[0]):null;
};
const eventSides=(event:Record<string,unknown>)=>{
 const teams=arr(event.teams).map(obj);
 const away=teams.find(x=>x.is_away===true)||teams[0]||{};
 const home=teams.find(x=>x.is_away===false)||teams[1]||{};
 return {away:str(away.name)||'Away',home:str(home.name)||'Home'};
};
function lineSelection(participant:Record<string,unknown>,market:string,line:Record<string,unknown>){
 const name=str(participant.name)||String(participant.id||'Selection');
 const value=line.value;
 const point=numeric(value);
 if(market==='spreads'&&point!==null&&!/\d/.test(name))return `${name} ${point>0?'+':''}${point}`;
 if(market==='totals'){
  const lower=(name+' '+String(value??'')).toLowerCase();
  const side=lower.includes('under')?'Under':lower.includes('over')?'Over':name;
  return point===null?side:`${side} ${point}`;
 }
 return name;
}
export function normalizeTheRundownPayload(payload:unknown,sportId:string,delaySeconds=300){
 const rows:Row[]=[];
 for(const eventRaw of arr(obj(payload).events)){
  const event=obj(eventRaw),eventId=str(event.event_id),start=str(event.event_date);
  if(!eventId||!start)continue;
  const {away,home}=eventSides(event);
  for(const marketRaw of arr(event.markets)){
   const marketObj=obj(marketRaw),market=marketName(marketObj.name);
   if(!['h2h','spreads','totals'].includes(market))continue;
   for(const participantRaw of arr(marketObj.participants)){
    const participant=obj(participantRaw);
    for(const lineRaw of arr(participant.lines)){
     const line=obj(lineRaw),selection=lineSelection(participant,market,line);
     for(const [affiliate,priceRaw] of Object.entries(obj(line.prices))){
      const price=obj(priceRaw),odds=Number(price.price),updated=str(price.updated_at);
      if(!BOOKS[affiliate]||!Number.isFinite(odds)||Math.abs(odds)<100||!updated)continue;
      rows.push({
       id:`therundown:${eventId}:${marketObj.market_id||market}:${participant.id||selection}:${affiliate}:${String(line.value??'main')}`,
       sport:SPORT_LABELS[sportId]||`SPORT-${sportId}`,league:SPORT_LABELS[sportId]||`SPORT-${sportId}`,
       event:`${away} @ ${home}`,home,away,selection,market,startTime:start,odds,bookmaker:BOOKS[affiliate],
       pulledAt:updated,sourceDelaySeconds:delaySeconds,liveEligible:false
      });
     }
    }
   }
  }
 }
 return rows;
}
function quotaHeaders(res:Response){
 return ['x-datapoints','x-datapoints-used','x-datapoints-remaining','x-datapoints-limit','x-datapoints-period']
  .map(k=>{const v=res.headers.get(k);return v?`${k}=${v}`:''}).filter(Boolean);
}
async function load(apiKey:string){
 const date=new Date().toISOString().slice(0,10);
 const started=Date.now(); const all:Row[]=[]; const quotas:string[]=[];
 for(const sportId of rotatingSportIds()){
  const url=new URL(`https://therundown.io/api/v2/sports/${sportId}/events/${date}`);
  url.searchParams.set('market_ids','1,2,3');
  url.searchParams.set('affiliate_ids','19,22,23');
  url.searchParams.set('main_line','true');
  url.searchParams.set('hide_closed','true');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs());
  try{
   const res=await fetch(url,{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json','X-TheRundown-Key':apiKey,'User-Agent':'Edgeforce-AI/119 provider-mesh'}});
   quotas.push(...quotaHeaders(res));
   if(res.status===429)throw new Error('TheRundown HTTP 429');
   if(res.status===401||res.status===403)throw new Error(`TheRundown HTTP ${res.status}`);
   if(!res.ok)continue;
   const delay=Number(res.headers.get('x-data-delay-seconds'));
   const delaySeconds=Number.isFinite(delay)&&delay>=0?delay:300;
   all.push(...normalizeTheRundownPayload(await res.json(),sportId,delaySeconds));
   const remaining=Number(res.headers.get('x-datapoints-remaining'));
   const reserve=Math.max(0,Number(process.env.THERUNDOWN_MIN_REMAINING||2500));
   if(Number.isFinite(remaining)&&remaining<=reserve)break;
  }finally{clearTimeout(timer)}
 }
 return {at:Date.now(),rows:all,status:200,latencyMs:Date.now()-started,quota:[...new Set(quotas)]};
}

export function theRundownProvider(env:Record<string,string|undefined>=process.env):ProviderConfig|null{
 const key=env.THERUNDOWN_API_KEY?.trim();
 if(env.THERUNDOWN_ENABLED!=='true'||!key||key==='[SENSITIVE]'||/[\s\u0000-\u001f\u007f]/.test(key))return null;
 return {id:'therundown',name:'TheRundown (delayed pregame)',capability:'ODDS',url:'therundown://pregame-main',
  apiKey:key,authHeader:'X-TheRundown-Key',authScheme:'',priority:Math.max(1,Number(env.THERUNDOWN_PRIORITY||110)),timeoutMs:12000,enabled:true,
  bookmaker:'TheRundown',maxAgeMin:15,failureThreshold:3,quarantineMin:5,marketRole:'REFERENCE',consensusWeight:1};
}

export async function fetchTheRundownBoard(config:ProviderConfig):Promise<ProviderFetchResult<unknown>>{
 const started=Date.now(),apiKey=config.apiKey||'';
 const base={providerId:config.id,providerName:config.name,capability:config.capability,receivedAt:new Date().toISOString()};
 if(!apiKey)return {...base,ok:false,latencyMs:0,error:'TheRundown key is not configured'};
 if(cache&&Date.now()-cache.at<cacheMs())return {...base,ok:cache.rows.length>0,latencyMs:0,status:cache.status,data:cache.rows,
  error:cache.rows.length?undefined:'TheRundown cached snapshot contains no supported prices'};
 if(!inFlight)inFlight=load(apiKey).finally(()=>{inFlight=null});
 try{
  const result=await inFlight; cache=result;
  return {...base,ok:result.rows.length>0,latencyMs:result.latencyMs,status:result.status,data:result.rows,
   error:result.rows.length?undefined:`TheRundown returned no supported prices${result.quota.length?' | '+result.quota.join(','):''}`};
 }catch(error){
  if(cache&&Date.now()-cache.at<cacheMs()*3)return {...base,ok:cache.rows.length>0,latencyMs:Date.now()-started,status:cache.status,data:cache.rows,
   error:'TheRundown refresh failed; using bounded cached real rows'};
  return {...base,ok:false,latencyMs:Date.now()-started,error:error instanceof Error?error.message:'TheRundown request failed'};
 }
}
