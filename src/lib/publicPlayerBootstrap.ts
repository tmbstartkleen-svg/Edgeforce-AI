import {db} from './db';
import type {Market} from './types';
import {ingestPlayerHistoryPayload,normalizePlayerName} from './playerWarehouse';

type AnyRow=Record<string,unknown>;
type EspnSpec={sport:string;league:string;searchSport:string;edgeSport:string};

const obj=(v:unknown):AnyRow=>v&&typeof v==='object'&&!Array.isArray(v)?v as AnyRow:{};
const arr=(v:unknown)=>Array.isArray(v)?v:[];
const str=(v:unknown)=>typeof v==='string'?v.trim():'';
const num=(v:unknown)=>{
 const n=typeof v==='number'?v:Number(v);
 return Number.isFinite(n)?n:undefined;
};

const cache=new Map<string,{at:number;value:unknown|null}>();
let lastRunAt=0;
let inFlight:Promise<PublicPlayerBootstrapResult>|null=null;

export type PublicPlayerBootstrapResult={
 enabled:boolean;
 requested:number;
 alreadyKnown:number;
 searched:number;
 resolved:number;
 playersWithGames:number;
 gameRows:number;
 gamesWritten:number;
 athletesTouched:number;
 featureSnapshotsWritten:number;
 warnings:string[];
 attempts:Array<{name:string;sport:string;stage:string;detail:string}>;
};

function cleanPlayerLabel(value:string){
 return String(value||'')
  .replace(/\s*\([A-Z0-9 .'-]{2,8}\)\s*$/i,'')
  .replace(/\s+/g,' ')
  .trim();
}

function normalizeSearchName(value:string){
 const tokens=normalizePlayerName(cleanPlayerLabel(value))
  .replace(/\b(jr|sr|ii|iii|iv|v)\b/g,'')
  .split(/\s+/)
  .filter(Boolean);
 const out:string[]=[];
 for(let i=0;i<tokens.length;i++){
  if(tokens[i].length===1){
   let combined=tokens[i];
   while(i+1<tokens.length&&tokens[i+1].length===1){
    combined+=tokens[++i];
   }
   out.push(combined);
  }else{
   out.push(tokens[i]);
  }
 }
 return out.join(' ');
}

function specForMarket(m:Market):EspnSpec|null{
 const s=`${m.sport} ${m.league}`.toLowerCase();
 if(/ncaaf|college.?football|football_ncaaf/.test(s))return {sport:'football',league:'college-football',searchSport:'football',edgeSport:m.sport};
 if(/\bnfl\b|football_nfl/.test(s))return {sport:'football',league:'nfl',searchSport:'football',edgeSport:m.sport};
 if(/\bnba\b|basketball_nba/.test(s))return {sport:'basketball',league:'nba',searchSport:'basketball',edgeSport:m.sport};
 if(/\bwnba\b|basketball_wnba/.test(s))return {sport:'basketball',league:'wnba',searchSport:'basketball',edgeSport:m.sport};
 if(/\bmlb\b|baseball_mlb/.test(s))return {sport:'baseball',league:'mlb',searchSport:'baseball',edgeSport:m.sport};
 if(/\bnhl\b|hockey_nhl/.test(s))return {sport:'hockey',league:'nhl',searchSport:'hockey',edgeSport:m.sport};
 return null;
}

function enabled(){
 if(process.env.PUBLIC_PLAYER_BOOTSTRAP_ENABLED==='false')return false;
 return process.env.PUBLIC_PLAYER_BOOTSTRAP_ENABLED==='true'||
  process.env.NODE_ENV==='development'||
  process.env.DEPLOYMENT_ENV==='production';
}

function batchSize(){
 const n=Number(process.env.PUBLIC_PLAYER_BOOTSTRAP_BATCH||4);
 return Number.isFinite(n)?Math.max(1,Math.min(8,Math.floor(n))):4;
}

function timeoutMs(){
 const n=Number(process.env.PUBLIC_PLAYER_BOOTSTRAP_TIMEOUT_MS||2500);
 return Number.isFinite(n)?Math.max(1000,Math.min(5000,n)):2500;
}

async function json(url:string,ttlMs=30*60000){
 const hit=cache.get(url);
 if(hit&&Date.now()-hit.at<ttlMs)return hit.value;
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs());
 try{
  const res=await fetch(url,{
   cache:'no-store',
   signal:controller.signal,
   headers:{
    Accept:'application/json, text/plain, */*',
    'User-Agent':'Mozilla/5.0 (compatible; EdgeForce-AI/1.0)'
   }
  });
  if(!res.ok)throw new Error(`HTTP ${res.status}`);
  const value=await res.json();
  cache.set(url,{at:Date.now(),value});
  return value;
 }catch{
  cache.set(url,{at:Date.now(),value:null});
  return null;
 }finally{
  clearTimeout(timer);
 }
}

function athleteIdFromRow(row:AnyRow){
 const direct=str(row.id||row.athleteId||row.athlete_id);
 if(/^\d{1,12}$/.test(direct))return direct;
 const uid=str(row.uid);
 const uidMatch=uid.match(/(?:^|~)a:(\d{1,12})(?:~|$)/);
 if(uidMatch)return uidMatch[1];
 const ref=str(row.$ref||row.href||obj(row.link).web);
 const refMatch=ref.match(/\/athletes\/(\d{1,12})(?:\/|\?|$)/);
 return refMatch?.[1]||'';
}

function collectAthleteCandidates(payload:unknown){
 const out:Array<{id:string;name:string;type:string;sport:string;league:string}>=[];
 const seen=new Set<string>();
 const root=obj(payload);
 const playerGroups=arr(root.results)
  .map(obj)
  .filter(group=>str(group.type).toLowerCase()==='player');
 const roots=playerGroups.length
  ?playerGroups.flatMap(group=>arr(group.contents))
  :[payload];

 const visit=(value:unknown)=>{
  if(Array.isArray(value)){for(const x of value)visit(x);return}
  if(!value||typeof value!=='object')return;
  const row=obj(value);
  const id=athleteIdFromRow(row);
  const athlete=obj(row.athlete);
  const name=str(
   row.displayName||row.fullName||row.name||
   athlete.displayName||athlete.fullName||athlete.name
  );
  const type=str(row.type||row.contentType||row.resultType||row.category).toLowerCase();
  const sport=str(row.sport||obj(row.sport).name||row.description).toLowerCase();
  const league=str(row.league||row.defaultLeagueSlug||obj(row.league).name||row.description).toLowerCase();
  if(id&&name){
   const key=id+'|'+normalizePlayerName(name);
   if(!seen.has(key)){
    seen.add(key);
    out.push({id,name,type,sport,league});
   }
  }
  for(const child of Object.values(row))visit(child);
 };
 for(const rootValue of roots)visit(rootValue);
 return out;
}

function resolveAthlete(payload:unknown,name:string,spec:EspnSpec){
 const target=normalizeSearchName(name);
 const candidates=collectAthleteCandidates(payload);
 const exact=candidates.filter(x=>normalizeSearchName(x.name)===target);
 if(!exact.length)return null;
 if(exact.length===1)return exact[0];

 const leagueNeedle=spec.league.replace('college-football','college football').toLowerCase();
 const sportNeedle=spec.sport.toLowerCase();
 const leagueMatches=exact.filter(x=>
  x.league.includes(leagueNeedle)||
  x.league.replaceAll('-',' ').includes(leagueNeedle)||
  x.sport.includes(sportNeedle)
 );
 if(leagueMatches.length===1)return leagueMatches[0];
 return null;
}

function numericStats(names:string[],values:unknown[]){
 const stats:Record<string,number>={};
 names.forEach((name,i)=>{
  const value=num(values[i]);
  if(value!==undefined)stats[name]=value;
 });
 return stats;
}

function gamelogRows(payload:unknown,athlete:{id:string;name:string},spec:EspnSpec){
 const root=obj(payload);
 const statNames=arr(root.names).map(String);
 const metadata=obj(root.events);
 const rows:AnyRow[]=[];

 const pushEvent=(event:AnyRow,eventIdHint='')=>{
  const eventId=str(event.eventId||event.id||eventIdHint);
  const values=arr(event.stats);
  const stats=numericStats(statNames,values);
  if(!eventId||!Object.keys(stats).length)return;
  const meta=obj(metadata[eventId]);
  const opponent=obj(meta.opponent);
  const team=obj(meta.team);
  rows.push({
   playerName:athlete.name,
   playerId:athlete.id,
   sport:spec.edgeSport,
   eventId,
   gameDate:str(meta.gameDate||meta.date||event.date),
   opponent:str(opponent.displayName||opponent.name||meta.opponentName),
   team:str(team.displayName||team.name||meta.teamName),
   homeAway:str(meta.atVs||meta.homeAway),
   stats,
   source:'espn-public-gamelog'
  });
 };

 for(const stValue of arr(root.seasonTypes)){
  const st=obj(stValue);
  for(const catValue of arr(st.categories)){
   const cat=obj(catValue);
   if(str(cat.type)&&str(cat.type)!=='event')continue;
   for(const eventValue of arr(cat.events))pushEvent(obj(eventValue));
  }
 }

 if(!rows.length&&Array.isArray(root.events)){
  for(const eventValue of arr(root.events))pushEvent(obj(eventValue));
 }

 return rows;
}

async function fetchMlbPlayer(name:string,spec:EspnSpec){
 const attempts:Array<{name:string;sport:string;stage:string;detail:string}>=[];
 const cleanName=cleanPlayerLabel(name);
 const searchUrl=new URL('https://statsapi.mlb.com/api/v1/people/search');
 searchUrl.searchParams.set('names',cleanName);

 const search=await json(searchUrl.toString(),6*3600000);
 const people=arr(obj(search).people).map(obj);
 const exact=people.filter(p=>normalizeSearchName(str(p.fullName||p.name))===normalizeSearchName(cleanName));
 const person=exact.length===1?exact[0]:people.length===1?people[0]:null;

 attempts.push({
  name,sport:spec.edgeSport,stage:'mlb-search',
  detail:`candidates=${people.length}; exact=${exact.length}`
 });

 if(!person){
  attempts.push({name,sport:spec.edgeSport,stage:'resolve',detail:'no unique MLB player match'});
  return {athlete:null,rows:[] as AnyRow[],attempts};
 }

 const id=str(person.id);
 const displayName=str(person.fullName||person.name)||cleanName;
 const athlete={id,name:displayName};
 attempts.push({name,sport:spec.edgeSport,stage:'resolve',detail:`mlbId=${id}; matched=${displayName}`});

 const year=new Date().getUTCFullYear();
 for(const season of [year,year-1]){
  const url=new URL(`https://statsapi.mlb.com/api/v1/people/${encodeURIComponent(id)}/stats/`);
  url.searchParams.set('stats','gameLog');
  url.searchParams.set('group','hitting,pitching,fielding');
  url.searchParams.set('season',String(season));
  const payload=await json(url.toString(),6*3600000);
  const rows:AnyRow[]=[];
  for(const groupValue of arr(obj(payload).stats)){
   const group=obj(groupValue);
   for(const splitValue of arr(group.splits)){
    const split=obj(splitValue);
    const stat=obj(split.stat);
    if(!Object.keys(stat).length)continue;
    const game=obj(split.game);
    const opponent=obj(split.opponent);
    const team=obj(split.team);
    rows.push({
     playerName:displayName,
     playerId:id,
     sport:spec.edgeSport,
     eventId:str(game.gamePk||game.id)||`mlb-${id}-${str(split.date)}-${rows.length}`,
     gameDate:str(split.date),
     opponent:str(opponent.name||opponent.teamName),
     team:str(team.name||team.teamName),
     homeAway:split.isHome===true?'home':split.isHome===false?'away':'',
     stats:stat,
     source:'mlb-statsapi-gamelog'
    });
   }
  }
  attempts.push({name,sport:spec.edgeSport,stage:'gamelog',detail:`MLB season ${season}: rows=${rows.length}`});
  if(rows.length)return {athlete,rows,attempts};
 }

 return {athlete,rows:[] as AnyRow[],attempts};
}

async function fetchPlayer(name:string,spec:EspnSpec){
 if(spec.league==='mlb')return fetchMlbPlayer(name,spec);
 const attempts:Array<{name:string;sport:string;stage:string;detail:string}>=[];
 const cleanName=cleanPlayerLabel(name);
 const buildSearch=()=>{
  const url=new URL('https://site.web.api.espn.com/apis/search/v2');
  url.searchParams.set('query',cleanName);
  url.searchParams.set('limit','10');
  url.searchParams.set('type','player');
  url.searchParams.set('region','us');
  url.searchParams.set('lang','en');
  return url.toString();
 };

 const search=await json(buildSearch(),6*3600000);
 if(!search){
  attempts.push({name,sport:spec.edgeSport,stage:'search',detail:'request failed or returned no JSON'});
  return {athlete:null,rows:[] as AnyRow[],attempts};
 }

 const candidates=collectAthleteCandidates(search);
 attempts.push({
  name,sport:spec.edgeSport,stage:'search',
  detail:`candidates=${candidates.length}; exact=${candidates.filter(x=>normalizeSearchName(x.name)===normalizeSearchName(name)).length}`
 });

 const athlete=resolveAthlete(search,cleanName,spec);
 if(!athlete){
  attempts.push({name,sport:spec.edgeSport,stage:'resolve',detail:'no unique exact-name athlete match'});
  return {athlete:null,rows:[] as AnyRow[],attempts};
 }

 attempts.push({name,sport:spec.edgeSport,stage:'resolve',detail:`athleteId=${athlete.id}; matched=${athlete.name}`});

 const year=new Date().getUTCFullYear();
 const seasons=[year,year-1];
 for(const season of seasons){
  const url=`https://site.web.api.espn.com/apis/common/v3/sports/${spec.sport}/${spec.league}/athletes/${encodeURIComponent(athlete.id)}/gamelog?season=${season}`;
  const gamelog=await json(url,6*3600000);
  if(!gamelog){
   attempts.push({name,sport:spec.edgeSport,stage:'gamelog',detail:`season ${season}: request failed or empty JSON`});
   continue;
  }
  const rows=gamelogRows(gamelog,athlete,spec);
  attempts.push({name,sport:spec.edgeSport,stage:'gamelog',detail:`season ${season}: rows=${rows.length}`});
  if(rows.length)return {athlete,rows,attempts};
 }
 return {athlete,rows:[] as AnyRow[],attempts};
}

async function run(markets:Market[]):Promise<PublicPlayerBootstrapResult>{
 const base:PublicPlayerBootstrapResult={
  enabled:enabled(),requested:0,alreadyKnown:0,searched:0,resolved:0,
  playersWithGames:0,gameRows:0,gamesWritten:0,athletesTouched:0,
  featureSnapshotsWritten:0,warnings:[],attempts:[]
 };
 if(!base.enabled)return base;
 const sql=db();
 if(!sql)return {...base,warnings:['database not configured']};

 const byName=new Map<string,{name:string;spec:EspnSpec}>();
 for(const market of markets){
  const name=market.playerContext?.name;
  const spec=specForMarket(market);
  if(!name||!spec)continue;
  const key=normalizePlayerName(name);
  if(key&&!byName.has(key))byName.set(key,{name,spec});
 }
 base.requested=byName.size;
 if(!byName.size)return base;

 const names=[...byName.keys()];
 const existing=await sql`
  select normalized_name as "normalizedName"
  from athletes
  where normalized_name in ${sql(names)}
 `.catch(()=>[]);
 const known=new Set((existing as any[]).map(x=>String(x.normalizedName)));
 base.alreadyKnown=known.size;

 const missing=[...byName.entries()]
  .filter(([key])=>!known.has(key))
  .slice(0,batchSize());
 if(!missing.length)return base;

 base.searched=missing.length;
 const fetched=await Promise.all(
  missing.map(async([,item])=>{
   try{return await fetchPlayer(item.name,item.spec)}
   catch(error){return {
    athlete:null,rows:[] as AnyRow[],
    attempts:[{name:item.name,sport:item.spec.edgeSport,stage:'exception',detail:error instanceof Error?error.message:'unknown error'}]
   }}
  })
 );
 base.attempts=fetched.flatMap(x=>x.attempts||[]).slice(0,40);
 base.resolved=fetched.filter(x=>Boolean(x.athlete)).length;
 base.playersWithGames=fetched.filter(x=>x.rows.length>0).length;
 const rows=fetched.flatMap(x=>x.rows);
 base.gameRows=rows.length;
 if(!rows.length){
  base.warnings.push('No ESPN game-log rows resolved for this bootstrap batch');
  return base;
 }

 const ingested=await ingestPlayerHistoryPayload(rows,'espn-public-gamelog');
 base.gamesWritten=ingested.gamesWritten;
 base.athletesTouched=ingested.athletesTouched;
 base.featureSnapshotsWritten=ingested.featureSnapshotsWritten;
 if(ingested.error)base.warnings.push(ingested.error);
 return base;
}

export async function bootstrapPublicPlayerHistory(markets:Market[]){
 const minInterval=Math.max(15000,Number(process.env.PUBLIC_PLAYER_BOOTSTRAP_INTERVAL_MS||60000));
 if(inFlight)return inFlight;
 if(Date.now()-lastRunAt<minInterval){
  return {
   enabled:enabled(),requested:0,alreadyKnown:0,searched:0,resolved:0,
   playersWithGames:0,gameRows:0,gamesWritten:0,athletesTouched:0,
   featureSnapshotsWritten:0,warnings:['bootstrap interval cache active'],attempts:[]
  } satisfies PublicPlayerBootstrapResult;
 }
 lastRunAt=Date.now();
 inFlight=run(markets).finally(()=>{inFlight=null});
 return inFlight;
}
