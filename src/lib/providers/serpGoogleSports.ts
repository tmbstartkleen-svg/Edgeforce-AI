/** Supplemental Google Sports research via SerpApi, never a bookmaker odds feed.
 * The UI must preserve order-neutral team labels until the game explicitly marks home/away.
 */
export type SerpSportsTarget={id:string;name:string;kgmid:string;sp:'ft'|'bs'|'bb'|'cr'|'af'|'ih'|'rg'};
export type SerpSportsGame={
 id:string;league:string;status:'SCHEDULED'|'LIVE'|'FINAL'|'DELAYED'|'UNKNOWN';
 statusDetail:string;startTime:string;observedAt:string;
 teamA:{name:string;score:number|null};teamB:{name:string;score:number|null};
 source:'serpapi-google-sports';homeAwayConfirmed:false;
};
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const arr=(v:unknown):unknown[]=>Array.isArray(v)?v:[];
const str=(v:unknown)=>typeof v==='string'?v.trim():'';
const kg=/^\/(?:m|g)\/[a-zA-Z0-9_]+$/;
const sportCodes=new Set(['ft','bs','bb','cr','af','ih','rg']);

export function configuredSerpSportsTargets(env:Record<string,string|undefined>=process.env):SerpSportsTarget[]{
 const raw=env.SERPAPI_SPORTS_TARGETS_JSON;
 if(!raw||raw.length>8000)return [];
 let parsed:unknown;
 try{parsed=JSON.parse(raw)}catch{return []}
 const results:SerpSportsTarget[]=[];
 for(const x of arr(parsed).slice(0,12)){
  const v=obj(x),id=str(v.id),name=str(v.name),kgmid=str(v.kgmid),sp=str(v.sp);
  if(!/^[a-z0-9-]{2,28}$/.test(id)||name.length<2||name.length>60||!kg.test(kgmid)||!sportCodes.has(sp)||results.some(t=>t.id===id))continue;
  results.push({id,name,kgmid,sp:sp as SerpSportsTarget['sp']});
 }
 return results.slice(0,8);
}

function observedTimestamp(v:unknown):string|null{
 const raw=str(v);
 if(!raw)return null;
 const ms=Date.parse(raw.endsWith(' UTC')?raw.replace(' UTC','Z').replace(' ','T'):raw);
 return Number.isFinite(ms)?new Date(ms).toISOString():null;
}
function score(v:unknown):number|null{
 if(v===null||v===undefined||v==='')return null;
 const value=typeof v==='number'||typeof v==='string'?Number(v):NaN;
 return Number.isFinite(value)&&value>=0&&value<=1000?value:null;
}
function status(value:string):SerpSportsGame['status']{
 const v=value.toLowerCase();
 if(/finish|final|full.time|ended|completed/.test(v))return 'FINAL';
 if(/live|in.progress|half.time|quarter|period|inning/.test(v))return 'LIVE';
 if(/postpon|cancel|delay|suspend/.test(v))return 'DELAYED';
 if(/scheduled|upcoming|not.started|pre.game/.test(v))return 'SCHEDULED';
 return 'UNKNOWN';
}
export function parseSerpGoogleSports(payload:unknown,target:SerpSportsTarget):{
 games:SerpSportsGame[];observedAt:string|null;warning?:string;
}{
 const root=obj(payload),meta=obj(root.search_metadata);
 if(str(root.error)||str(meta.status)==='Error')return {games:[],observedAt:null,warning:'SerpApi returned an error'};
 if(str(meta.status)!=='Success')return {games:[],observedAt:null,warning:'Google Sports search is incomplete'};
 const observedAt=observedTimestamp(meta.created_at||meta.processed_at);
 if(!observedAt)return {games:[],observedAt:null,warning:'Response has no reliable source observation timestamp'};
 const grouped=arr(obj(root.league_results).game_groups).flatMap(g=>arr(obj(g).games));
 const seen=new Set<string>();
 const games:SerpSportsGame[]=[];
 for(const raw of grouped.slice(0,300)){
  const game=obj(raw),teams=arr(game.teams).map(obj),a=teams[0],b=teams[1];
  const start=str(game.start_time),nameA=str(a?.name),nameB=str(b?.name);
  const id=str(game.kgmid);
  if(teams.length!==2||!nameA||!nameB||nameA===nameB||!Number.isFinite(Date.parse(start))||!kg.test(id)||seen.has(id))continue;
  seen.add(id);
  const detail=str(game.status_original)||str(game.status)||'Status unavailable';
  games.push({
   id,league:str(obj(game.league).name)||target.name,status:status(str(game.status)||detail),
   statusDetail:detail,startTime:new Date(start).toISOString(),observedAt,
   teamA:{name:nameA,score:score(a.score)},teamB:{name:nameB,score:score(b.score)},
   source:'serpapi-google-sports',homeAwayConfirmed:false
  });
 }
 return {games,observedAt};
}
export async function requestSerpGoogleSports(apiKey:string,target:SerpSportsTarget,fetcher:typeof fetch=fetch){
 const url=new URL('https://serpapi.com/search.json');
 for(const [key,value] of Object.entries({engine:'google_sports',kgmid:target.kgmid,sp:target.sp,type:'league',tab:'gm',gl:'us',hl:'en',no_cache:'false',api_key:apiKey}))url.searchParams.set(key,value);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);
 try{
  const response=await fetcher(url.toString(),{method:'GET',cache:'no-store',redirect:'error',signal:controller.signal,headers:{Accept:'application/json'}});
  if(!response.ok){await response.body?.cancel();throw new Error('SerpApi HTTP '+response.status)}
  if(!response.headers.get('content-type')?.includes('json'))throw new Error('SerpApi returned non-JSON');
  const size=Number(response.headers.get('content-length')||0);
  if(size>1572864)throw new Error('SerpApi response exceeded safe payload limit');
  // Strict size limit even when transfer encoding omitted content-length.
  const reader=response.body?.getReader();
  if(!reader)throw new Error('SerpApi response is empty');
  const chunks:Uint8Array[]=[];let total=0;
  try{
   for(;;){
    const part=await reader.read();if(part.done)break;
    total+=part.value.length;
    if(total>1572864){await reader.cancel();throw new Error('SerpApi response exceeded safe payload limit')}
    chunks.push(part.value);
   }
  }finally{reader.releaseLock()}
  const bytes=new Uint8Array(total);let at=0;
  for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length}
  const parsed=parseSerpGoogleSports(JSON.parse(new TextDecoder().decode(bytes)),target);
  if(parsed.warning)throw new Error(parsed.warning);
  return parsed;
 }finally{clearTimeout(timer)}
}
