import type {Market,ContextProvenance} from '../types';
import {combineScheduleSignals,deriveScheduleLoad,deriveTravelBurden} from '../scheduleFatigueIntelligence';
import {deriveVenueConditionSignals,normalizeSurface} from '../venueWeatherIntelligence';

export type PublicContextRow={
 event?:string;
 home?:string;
 away?:string;
 sport?:string;
 features:Record<string,number>;
 player?:{
  name:string;
  team?:string;
  status?:string;
  starter?:boolean;
  availability?:number;
  projection?:number;
  stdDev?:number;
  minutes?:number;
  usage?:number;
  statKey?:string;
 };
 source:'espn-public'|'open-meteo';
 provenance:ContextProvenance[];
};

type LeagueSpec={
 key:string;
 sport:string;
 league:string;
 outdoor:boolean;
};

export type EspnEvent={
 id:string;
 date:string;
 name:string;
 home:string;
 away:string;
 homeId?:string;
 awayId?:string;
 homeRecord?:number;
 awayRecord?:number;
 venue?:{
  name?:string;
  city?:string;
  state?:string;
  country?:string;
  indoor?:boolean;
  surface?:string;
 };
 raw:Record<string,unknown>;
};

export type InjuryEntry={
 team:string;
 player:string;
 status:string;
 position?:string;
 starter?:boolean;
};

type Cached={at:number;value:unknown;ok:boolean;status?:number;error?:string};
const requestCache=new Map<string,Cached>();

const clamp=(n:number,min=-1,max=1)=>Math.max(min,Math.min(max,n));
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const str=(v:unknown)=>typeof v==='string'?v:'';
const arr=(v:unknown)=>Array.isArray(v)?v:[];

function normalizeName(v:string){
 return v.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
function tokens(v:string){
 return new Set(normalizeName(v).split(/\s+/).filter(x=>x.length>1&&!['fc','cf','the','united','state'].includes(x)));
}
function similarity(a:string,b:string){
 const aa=normalizeName(a),bb=normalizeName(b);
 if(!aa||!bb)return 0;
 if(aa===bb)return 1;
 if(aa.includes(bb)||bb.includes(aa))return .9;
 const A=tokens(a),B=tokens(b);
 if(!A.size||!B.size)return 0;
 let common=0;
 for(const x of A)if(B.has(x))common++;
 return common/Math.max(A.size,B.size);
}
function leagueSpec(m:Market):LeagueSpec|null{
 const s=`${m.sport} ${m.league}`.toUpperCase();
 if(/NFL|AMERICANFOOTBALL_NFL/.test(s))return {key:'nfl',sport:'football',league:'nfl',outdoor:true};
 if(/NCAAF|COLLEGE FOOTBALL|AMERICANFOOTBALL_NCAAF/.test(s))return {key:'ncaaf',sport:'football',league:'college-football',outdoor:true};
 if(/WNBA|BASKETBALL_WNBA/.test(s))return {key:'wnba',sport:'basketball',league:'wnba',outdoor:false};
 if(/NBA|BASKETBALL_NBA/.test(s))return {key:'nba',sport:'basketball',league:'nba',outdoor:false};
 if(/NCAAB|COLLEGE BASKETBALL/.test(s))return {key:'ncaab',sport:'basketball',league:'mens-college-basketball',outdoor:false};
 if(/MLB|BASEBALL_MLB/.test(s))return {key:'mlb',sport:'baseball',league:'mlb',outdoor:true};
 if(/NHL|ICEHOCKEY_NHL/.test(s))return {key:'nhl',sport:'hockey',league:'nhl',outdoor:false};
 if(/MLS|SOCCER_USA_MLS/.test(s))return {key:'mls',sport:'soccer',league:'usa.1',outdoor:true};
 if(/EPL|PREMIER LEAGUE|SOCCER_ENGLAND_LEAGUE1/.test(s))return {key:'epl',sport:'soccer',league:'eng.1',outdoor:true};
 if(/UFC|MMA/.test(s))return {key:'ufc',sport:'mma',league:'ufc',outdoor:false};
 return null;
}

const timeoutMs=()=>Math.max(1500,Number(process.env.PUBLIC_CONTEXT_TIMEOUT_MS)||5000);
async function fetchJson(url:string,ttlMs:number):Promise<Cached>{
 const cached=requestCache.get(url);
 if(cached&&Date.now()-cached.at<ttlMs)return cached;
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs());
 try{
  const res=await fetch(url,{
   cache:'no-store',
   signal:controller.signal,
   headers:{Accept:'application/json','User-Agent':'Edgeforce-AI/50 context-enrichment'}
  });
  if(!res.ok){
   const result:Cached={at:Date.now(),value:null,ok:false,status:res.status,error:`HTTP ${res.status}`};
   requestCache.set(url,result);
   return result;
  }
  const result:Cached={at:Date.now(),value:await res.json(),ok:true,status:res.status};
  requestCache.set(url,result);
  return result;
 }catch(error){
  const result:Cached={at:Date.now(),value:null,ok:false,error:error instanceof Error?error.message:'request failed'};
  requestCache.set(url,result);
  return result;
 }finally{clearTimeout(timer)}
}

function dateKey(iso:string){
 const d=new Date(iso);
 if(!Number.isFinite(d.getTime()))return '';
 return d.toISOString().slice(0,10).replaceAll('-','');
}
function surfaceName(v:unknown){
 const node=obj(v);
 const direct=str(v)||str(node.name)||str(node.type)||str(node.description)||str(node.displayName);
 return normalizeSurface(direct);
}
function teamName(v:unknown){
 const t=obj(v);
 return str(t.displayName)||str(t.shortDisplayName)||str(t.name)||str(t.location)||str(t.abbreviation);
}
function recordPct(competitor:Record<string,unknown>){
 for(const r of arr(competitor.records)){
  const rec=obj(r);
  const summary=str(rec.summary);
  const m=summary.match(/(\d+)-(\d+)(?:-(\d+))?/);
  if(m){
   const w=Number(m[1]),l=Number(m[2]),d=Number(m[3]||0);
   const total=w+l+d;
   if(total>0)return (w+d*.5)/total;
  }
  const value=Number(rec.value);
  if(Number.isFinite(value)&&value>=0&&value<=1)return value;
 }
 return undefined;
}

export function parseEspnScoreboard(payload:unknown):EspnEvent[]{
 const root=obj(payload);
 return arr(root.events).map(v=>{
  const e=obj(v);
  const competition=obj(arr(e.competitions)[0]);
  const competitors=arr(competition.competitors).map(obj);
  const home=competitors.find(x=>str(x.homeAway).toLowerCase()==='home')||competitors[0]||{};
  const away=competitors.find(x=>str(x.homeAway).toLowerCase()==='away')||competitors[1]||{};
  const venue=obj(competition.venue);
  const address=obj(venue.address);
  return {
   id:str(e.id)||str(competition.id),
   date:str(e.date)||str(competition.date),
   name:str(e.name)||str(e.shortName),
   home:teamName(home.team),
   away:teamName(away.team),
   homeId:str(obj(home.team).id)||str(home.id)||undefined,
   awayId:str(obj(away.team).id)||str(away.id)||undefined,
   homeRecord:recordPct(home),
   awayRecord:recordPct(away),
   venue:{
    name:str(venue.fullName)||str(venue.name)||undefined,
    city:str(address.city)||undefined,
    state:str(address.state)||undefined,
    country:str(address.country)||undefined,
    indoor:typeof venue.indoor==='boolean'?venue.indoor:undefined,
    surface:surfaceName(venue.surface||competition.surface||e.surface)
   },
   raw:e
  };
 }).filter(x=>x.id&&x.home&&x.away);
}

export function matchEspnEvent(m:Market,events:EspnEvent[]){
 const target=new Date(m.startTime).getTime();
 let best:{score:number;event:EspnEvent}|null=null;
 for(const event of events){
  const home=similarity(m.home,event.home);
  const away=similarity(m.away,event.away);
  const swapped=similarity(m.home,event.away)+similarity(m.away,event.home);
  const normal=home+away;
  const teamScore=Math.max(normal,swapped*.65);
  const time=new Date(event.date).getTime();
  const hours=Number.isFinite(target)&&Number.isFinite(time)?Math.abs(target-time)/3600000:6;
  const timeScore=hours<=2 ? 1 : hours<=6 ? .7 : hours<=18 ? .35 : 0;
  const score=teamScore*.8+timeScore*.2;
  if(score>=1.05&&(!best||score>best.score))best={score,event};
 }
 return best;
}

function teamFromNode(node:Record<string,unknown>){
 const direct=obj(node.team);
 return teamName(direct)||str(node.teamName)||str(node.teamDisplayName)||str(node.displayName);
}
function athleteFromNode(node:Record<string,unknown>){
 const athlete=obj(node.athlete);
 const player=obj(node.player);
 const a=Object.keys(athlete).length?athlete:player;
 return str(a.displayName)||str(a.fullName)||str(a.name)||str(node.athleteName)||str(node.playerName);
}
function positionFromNode(node:Record<string,unknown>){
 const athlete=obj(node.athlete);
 const position=obj(athlete.position);
 return str(position.abbreviation)||str(position.name)||str(node.position);
}
function statusFromNode(node:Record<string,unknown>){
 const status=obj(node.status);
 return str(status.name)||str(status.type)||str(status.description)||str(node.status)||str(node.injuryStatus);
}

export function parseEspnInjuries(payload:unknown){
 const out:InjuryEntry[]=[];
 const seen=new Set<string>();
 const visit=(value:unknown,teamHint='')=>{
  if(Array.isArray(value)){
   for(const v of value)visit(v,teamHint);
   return;
  }
  if(!value||typeof value!=='object')return;
  const node=obj(value);
  const ownTeam=teamFromNode(node)||teamHint;
  const player=athleteFromNode(node);
  const status=statusFromNode(node);
  if(player&&status){
   const key=`${ownTeam}|${player}|${status}`;
   if(!seen.has(key)){
    seen.add(key);
    out.push({
     team:ownTeam,player,status,
     position:positionFromNode(node)||undefined,
     starter:typeof node.starter==='boolean'?node.starter:typeof node.isStarter==='boolean'?node.isStarter:undefined
    });
   }
  }
  for(const [key,child] of Object.entries(node)){
   if(['team','athlete','player','status','position'].includes(key))continue;
   visit(child,ownTeam);
  }
 };
 visit(payload);
 return out;
}

function severity(status:string){
 const s=status.toLowerCase();
 if(/out|inactive|injured reserve|ir\b|suspended/.test(s))return 1;
 if(/doubtful/.test(s))return .8;
 if(/questionable|game-time|gtd/.test(s))return .5;
 if(/day-to-day|limited/.test(s))return .3;
 if(/probable|available/.test(s))return .12;
 return .18;
}
function availability(status:string){
 return clamp(1-severity(status),0,1);
}
function burden(team:string,entries:InjuryEntry[],position?:RegExp){
 const matches=entries.filter(x=>similarity(team,x.team)>=.65&&(!position||position.test(String(x.position||''))));
 if(!matches.length)return 0;
 return clamp(matches.reduce((sum,x)=>sum+severity(x.status),0)/Math.max(2,matches.length),0,1);
}
function directionalBurden(home:string,away:string,entries:InjuryEntry[],position?:RegExp){
 return clamp(burden(home,entries,position)-burden(away,entries,position));
}
function directionalHealth(home:string,away:string,entries:InjuryEntry[],position?:RegExp){
 return clamp(burden(away,entries,position)-burden(home,entries,position));
}

export function deriveInjurySignals(home:string,away:string,entries:InjuryEntry[],sportKey:string){
 const features:Record<string,number>={};
 if(!entries.length)return features;
 features.injury=directionalBurden(home,away,entries);
 if(sportKey==='nfl'||sportKey==='ncaaf')features.quarterback=directionalHealth(home,away,entries,/QB|QUARTERBACK/i);
 if(sportKey==='nhl')features.goalie=directionalHealth(home,away,entries,/G|GOALIE/i);
 return features;
}

function hasStarterSignals(payload:unknown,positions:RegExp){
 let count=0;
 const visit=(value:unknown)=>{
  if(Array.isArray(value)){for(const v of value)visit(v);return}
  if(!value||typeof value!=='object')return;
  const n=obj(value);
  const pos=positionFromNode(n);
  const starter=Boolean(n.starter||n.isStarter||n.probable||n.probableStarter);
  const context=JSON.stringify(Object.keys(n)).toLowerCase();
  if(pos&&positions.test(pos)&&(starter||/probable|starter|starting/.test(context)))count++;
  for(const child of Object.values(n))visit(child);
 };
 visit(payload);
 return count;
}

export function deriveRestDays(payload:unknown,targetIso:string){
 const target=new Date(targetIso).getTime();
 if(!Number.isFinite(target))return undefined;
 const dates:string[]=[];
 const root=obj(payload);
 const visit=(value:unknown)=>{
  if(Array.isArray(value)){for(const v of value)visit(v);return}
  if(!value||typeof value!=='object')return;
  const n=obj(value);
  const date=str(n.date);
  if(date)dates.push(date);
  for(const [k,child] of Object.entries(n))if(k!=='date')visit(child);
 };
 visit(root.events||payload);
 const prior=dates.map(x=>new Date(x).getTime()).filter(x=>Number.isFinite(x)&&x<target-6*3600000);
 if(!prior.length)return undefined;
 return Math.max(0,(target-Math.max(...prior))/86400000);
}

async function geocode(city:string,state?:string,country?:string){
 const query=[city,state,country].filter(Boolean).join(', ');
 if(!query)return null;
 const url=new URL('https://geocoding-api.open-meteo.com/v1/search');
 url.searchParams.set('name',query);
 url.searchParams.set('count','3');
 url.searchParams.set('language','en');
 url.searchParams.set('format','json');
 const res=await fetchJson(url.toString(),24*3600000);
 if(!res.ok)return null;
 const results=arr(obj(res.value).results).map(obj);
 const best=results[0];
 const latitude=Number(best?.latitude),longitude=Number(best?.longitude);
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return null;
 const elevation=Number(best?.elevation);
 return {latitude,longitude,name:str(best.name),admin1:str(best.admin1),country:str(best.country),timezone:str(best.timezone)||undefined,elevation:Number.isFinite(elevation)?elevation:undefined};
}

async function weatherAt(latitude:number,longitude:number,startTime:string){
 const url=new URL('https://api.open-meteo.com/v1/forecast');
 url.searchParams.set('latitude',String(latitude));
 url.searchParams.set('longitude',String(longitude));
 url.searchParams.set('hourly','temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,snowfall,cloud_cover,wind_speed_10m,wind_gusts_10m');
 url.searchParams.set('temperature_unit','fahrenheit');
 url.searchParams.set('wind_speed_unit','mph');
 url.searchParams.set('precipitation_unit','inch');
 url.searchParams.set('timezone','UTC');
 url.searchParams.set('forecast_days','16');
 const res=await fetchJson(url.toString(),10*60000);
 if(!res.ok)return null;
 const hourly=obj(obj(res.value).hourly);
 const times=arr(hourly.time).map(String);
 if(!times.length)return null;
 const target=new Date(startTime).getTime();
 let index=0,best=Infinity;
 times.forEach((time,i)=>{
  const delta=Math.abs(new Date(time+'Z').getTime()-target);
  if(delta<best){best=delta;index=i}
 });
 const at=(key:string)=>{
  const value=Number(arr(hourly[key])[index]);
  return Number.isFinite(value)?value:undefined;
 };
 const temperature=at('temperature_2m');
 const apparentTemperature=at('apparent_temperature');
 const humidity=at('relative_humidity_2m');
 const precipProbability=at('precipitation_probability');
 const precipitation=at('precipitation');
 const snowfall=at('snowfall');
 const cloudCover=at('cloud_cover');
 const windSpeed=at('wind_speed_10m');
 const windGust=at('wind_gusts_10m');
 const cold=temperature===undefined?0:Math.max(0,35-temperature)/35;
 const heat=temperature===undefined?0:Math.max(0,temperature-90)/30;
 const wind=Math.max(0,(windGust??windSpeed??0)-15)/30;
 const precip=(precipProbability??0)/100*.55+Math.min(1,(precipitation??0)/.25)*.35;
 const impact=clamp(cold*.20+heat*.15+wind*.45+precip*.45,0,1);
 return {temperature,apparentTemperature,humidity,precipProbability,precipitation,snowfall,cloudCover,windSpeed,windGust,impact,forecastTime:times[index]};
}

function publicMaxEvents(){
 const n=Number(process.env.PUBLIC_CONTEXT_MAX_EVENTS);
 return Number.isFinite(n)?Math.max(1,Math.min(30,Math.floor(n))):16;
}
function summaryMaxEvents(){
 const n=Number(process.env.PUBLIC_CONTEXT_SUMMARY_EVENTS);
 return Number.isFinite(n)?Math.max(0,Math.min(20,Math.floor(n))):8;
}
function scheduleMaxEvents(){
 const n=Number(process.env.PUBLIC_CONTEXT_SCHEDULE_EVENTS);
 return Number.isFinite(n)?Math.max(0,Math.min(12,Math.floor(n))):6;
}

export async function fetchPublicSportsContext(markets:Market[]){
 const enabled=process.env.PUBLIC_CONTEXT_ENABLED==='true'||process.env.DEPLOYMENT_ENV==='production';
 if(!enabled||process.env.PUBLIC_CONTEXT_ENABLED==='false'){
  return {rows:[] as PublicContextRow[],sourceQuality:{} as Record<string,number>,diagnostics:{enabled:false,matchedEvents:0,totalEvents:0,requests:0,warnings:['Public context network disabled outside production unless explicitly enabled']}};
 }

 const warnings:string[]=[];
 let requests=0;
 const unique=new Map<string,Market>();
 for(const m of markets){
  const spec=leagueSpec(m);
  if(!spec)continue;
  const key=[spec.key,normalizeName(m.home),normalizeName(m.away),m.startTime].join('|');
  if(!unique.has(key))unique.set(key,m);
 }
 const eventMarkets=[...unique.values()]
  .sort((a,b)=>new Date(a.startTime).getTime()-new Date(b.startTime).getTime())
  .slice(0,publicMaxEvents());

 const scoreboardCache=new Map<string,EspnEvent[]>();
 const injuryCache=new Map<string,InjuryEntry[]>();
 const matched:Array<{market:Market;spec:LeagueSpec;event:EspnEvent;injuries:InjuryEntry[]}>=[];

 for(const market of eventMarkets){
  const spec=leagueSpec(market);
  if(!spec)continue;
  const date=dateKey(market.startTime);
  const boardKey=`${spec.sport}/${spec.league}/${date}`;
  let events=scoreboardCache.get(boardKey);
  if(!events){
   const url=`https://site.api.espn.com/apis/site/v2/sports/${spec.sport}/${spec.league}/scoreboard?dates=${date}`;
   const res=await fetchJson(url,5*60000);requests++;
   events=res.ok?parseEspnScoreboard(res.value):[];
   scoreboardCache.set(boardKey,events);
   if(!res.ok)warnings.push(`ESPN scoreboard ${spec.key} failed: ${res.error||res.status}`);
  }
  const found=matchEspnEvent(market,events);
  if(!found)continue;

  let injuries=injuryCache.get(spec.key);
  if(!injuries){
   const url=`https://site.api.espn.com/apis/site/v2/sports/${spec.sport}/${spec.league}/injuries`;
   const res=await fetchJson(url,3*60000);requests++;
   injuries=res.ok?parseEspnInjuries(res.value):[];
   injuryCache.set(spec.key,injuries);
   if(!res.ok)warnings.push(`ESPN injuries ${spec.key} unavailable: ${res.error||res.status}`);
  }
  matched.push({market,spec,event:found.event,injuries});
 }

 const rows:PublicContextRow[]=[];
 let weatherRows=0,summaryRows=0,restRows=0,scheduleFatigueRows=0,playerRows=0;

 for(let index=0;index<matched.length;index++){
  const {market,spec,event,injuries}=matched[index];
  const features:Record<string,number>={home:1};
  const provenance:ContextProvenance[]=[];
  const now=new Date().toISOString();

  if(injuries.length){
   const injurySignals=deriveInjurySignals(event.home,event.away,injuries,spec.key);
   Object.assign(features,injurySignals);
   if('injury' in injurySignals)provenance.push({source:'espn-public',providerId:'espn-site-api',field:'injury',observedAt:now,confidence:.72,status:'LIVE'});
   if('quarterback' in injurySignals)provenance.push({source:'espn-public',providerId:'espn-site-api',field:'quarterback',observedAt:now,confidence:.66,status:'LIVE'});
   if('goalie' in injurySignals)provenance.push({source:'espn-public',providerId:'espn-site-api',field:'goalie',observedAt:now,confidence:.62,status:'LIVE'});
  }

  if(event.homeRecord!==undefined&&event.awayRecord!==undefined){
   features.form=clamp((event.homeRecord-event.awayRecord)*2);
   provenance.push({source:'espn-public',providerId:'espn-site-api',field:'form',observedAt:now,confidence:.60,status:'LIVE'});
  }

  if(index<summaryMaxEvents()){
   const url=`https://site.api.espn.com/apis/site/v2/sports/${spec.sport}/${spec.league}/summary?event=${encodeURIComponent(event.id)}`;
   const res=await fetchJson(url,5*60000);requests++;
   if(res.ok){
    summaryRows++;
    if(spec.key==='mlb'&&hasStarterSignals(res.value,/P|SP|PITCHER/i)>=2){
     features.starter=0;
     provenance.push({source:'espn-public',providerId:'espn-site-api',field:'starter',observedAt:now,confidence:.70,status:'CONFIRMED'});
    }
    if(spec.key==='nhl'&&hasStarterSignals(res.value,/G|GOALIE/i)>=2){
     features.goalie=features.goalie??0;
     provenance.push({source:'espn-public',providerId:'espn-site-api',field:'goalie',observedAt:now,confidence:.70,status:'CONFIRMED'});
    }
    if((spec.key==='nba'||spec.key==='wnba'||spec.key==='ncaab')&&hasStarterSignals(res.value,/G|F|C|GUARD|FORWARD|CENTER/i)>=8){
     features.lineup=0;
     provenance.push({source:'espn-public',providerId:'espn-site-api',field:'lineup',observedAt:now,confidence:.65,status:'CONFIRMED'});
    }
   }
  }

  if(index<scheduleMaxEvents()&&event.homeId&&event.awayId){
   const [homeSchedule,awaySchedule]=await Promise.all([
    fetchJson(`https://site.api.espn.com/apis/site/v2/sports/${spec.sport}/${spec.league}/teams/${event.homeId}/schedule`,30*60000),
    fetchJson(`https://site.api.espn.com/apis/site/v2/sports/${spec.sport}/${spec.league}/teams/${event.awayId}/schedule`,30*60000)
   ]);
   requests+=2;
   if(homeSchedule.ok&&awaySchedule.ok){
    const homeLoad=deriveScheduleLoad(homeSchedule.value,market.startTime,event.homeId,'home');
    const awayLoad=deriveScheduleLoad(awaySchedule.value,market.startTime,event.awayId,'away');
    const currentGeo=event.venue?.city?await geocode(event.venue.city,event.venue.state,event.venue.country):null;
    if(event.venue?.city)requests++;
    const [homePriorGeo,awayPriorGeo]=await Promise.all([
     homeLoad.priorVenue?.city?geocode(homeLoad.priorVenue.city,homeLoad.priorVenue.state,homeLoad.priorVenue.country):Promise.resolve(null),
     awayLoad.priorVenue?.city?geocode(awayLoad.priorVenue.city,awayLoad.priorVenue.state,awayLoad.priorVenue.country):Promise.resolve(null)
    ]);
    if(homeLoad.priorVenue?.city)requests++;
    if(awayLoad.priorVenue?.city)requests++;
    const homeTravel=deriveTravelBurden(homePriorGeo||undefined,currentGeo||undefined,homeLoad.restDays,market.startTime);
    const awayTravel=deriveTravelBurden(awayPriorGeo||undefined,currentGeo||undefined,awayLoad.restDays,market.startTime);
    const scheduleSignals=combineScheduleSignals(homeLoad,awayLoad,homeTravel,awayTravel);
    Object.assign(features,scheduleSignals);
    restRows++;
    scheduleFatigueRows++;
    provenance.push({
     source:'espn-public',providerId:'edgeforce-v67-schedule',field:'scheduleCompositeEdge',observedAt:now,
     confidence:.70+.25*scheduleSignals.scheduleContextConfidence,status:'LIVE',
     detail:{
      homeRestDays:homeLoad.restDays??null,awayRestDays:awayLoad.restDays??null,
      homeGames7d:homeLoad.games7d+1,awayGames7d:awayLoad.games7d+1,
      homeRoadStreak:homeLoad.roadStreak,awayRoadStreak:awayLoad.roadStreak,
      homeTravelMiles:Math.round(homeTravel.distanceMiles),awayTravelMiles:Math.round(awayTravel.distanceMiles),
      homeTimezoneShift:homeTravel.timezoneShiftHours,awayTimezoneShift:awayTravel.timezoneShiftHours,
      homeFatigue:homeLoad.fatigueLoad,awayFatigue:awayLoad.fatigueLoad
     }
    });
   }
  }

  if(event.venue?.city){
   const geo=await geocode(event.venue.city,event.venue.state,event.venue.country);requests++;
   let wx:null|Awaited<ReturnType<typeof weatherAt>>=null;
   const indoor=event.venue.indoor===true||(event.venue.indoor===undefined&&!spec.outdoor);
   if(geo&&!indoor){
    wx=await weatherAt(geo.latitude,geo.longitude,market.startTime);requests++;
   }
   if(geo&&(indoor||wx)){
    const condition=deriveVenueConditionSignals({
     sportKey:spec.key,indoor,surface:event.venue.surface,elevationFt:geo.elevation===undefined?undefined:geo.elevation*3.28084,
     weather:wx?{
      temperatureF:wx.temperature,apparentTemperatureF:wx.apparentTemperature,humidityPct:wx.humidity,
      precipitationProbability:wx.precipProbability,precipitationIn:wx.precipitation,snowfallIn:wx.snowfall,
      windMph:wx.windSpeed,windGustMph:wx.windGust,cloudCoverPct:wx.cloudCover,forecastTime:wx.forecastTime
     }:null,
     parkSignal:features.park
    });
    Object.assign(features,condition);
    weatherRows++;
    provenance.push({
     source:'venue-conditions',providerId:'edgeforce-v68-venue-conditions',field:'venueWeatherComposite',observedAt:now,
     confidence:condition.venueWeatherConfidence,status:indoor?'INDOOR':'FORECAST',
     detail:{
      venue:event.venue.name,city:event.venue.city,state:event.venue.state,country:event.venue.country,
      indoor,surface:event.venue.surface||null,elevationFt:geo.elevation===undefined?null:geo.elevation*3.28084,
      forecastTime:wx?.forecastTime||null,temperatureF:wx?.temperature??null,apparentTemperatureF:wx?.apparentTemperature??null,
      humidityPct:wx?.humidity??null,precipProbability:wx?.precipProbability??null,precipitationIn:wx?.precipitation??null,
      snowfallIn:wx?.snowfall??null,windMph:wx?.windSpeed??null,gustMph:wx?.windGust??null,cloudCoverPct:wx?.cloudCover??null
     }
    });
   }
  }

  rows.push({
   event:market.event,home:market.home,away:market.away,sport:market.sport,features,
   source:'espn-public',provenance
  });

  for(const injury of injuries){
   if(similarity(injury.team,event.home)<.65&&similarity(injury.team,event.away)<.65)continue;
   rows.push({
    event:market.event,home:market.home,away:market.away,sport:market.sport,features:{},
    source:'espn-public',
    player:{
     name:injury.player,team:injury.team,status:injury.status,starter:injury.starter,
     availability:availability(injury.status)
    },
    provenance:[{source:'espn-public',providerId:'espn-site-api',field:'playerAvailability',observedAt:now,confidence:.72,status:'LIVE',detail:{position:injury.position}}]
   });
   playerRows++;
  }
 }

 return {
  rows,
  sourceQuality:{'espn-public':.70,'open-meteo':.88,'venue-conditions':.90},
  diagnostics:{
   enabled:true,
   totalEvents:eventMarkets.length,
   matchedEvents:matched.length,
   eventMatchRate:eventMarkets.length?matched.length/eventMarkets.length:0,
   weatherRows,
   summaryRows,
   restRows,
   scheduleFatigueRows,
   playerRows,
   requests,
   cacheEntries:requestCache.size,
   warnings:[...new Set(warnings)].slice(0,20)
  }
 };
}
