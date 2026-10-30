export const PLAYER_LEAGUES:Record<string,string>={nba:'basketball/nba',wnba:'basketball/wnba',nfl:'football/nfl',nhl:'hockey/nhl',mlb:'baseball/mlb',ncaaf:'football/college-football',ncaab:'basketball/mens-college-basketball',epl:'soccer/eng.1'};
const safeLink=(s:unknown)=>typeof s==='string'&&/^https:\/\/([a-z0-9-]+\.)?espn\.com\//.test(s)?s:null;
const date=(s:unknown)=>typeof s==='string'&&Number.isFinite(Date.parse(s))?new Date(s).toISOString():null;
export function normalizePlayers(kind:string,body:any){
 if(kind==='teams'){
  const rows=body?.sports?.[0]?.leagues?.[0]?.teams;if(!Array.isArray(rows))throw new Error('Team directory format unavailable');
  return rows.flatMap((r:any)=>r?.team?.id&&r.team.displayName?[{id:String(r.team.id),name:r.team.displayName}]:[]);
 }
 if(kind==='injuries'){
  if(!Array.isArray(body?.injuries))throw new Error('Injury report format unavailable');
  return body.injuries.flatMap((team:any)=>Array.isArray(team?.injuries)?team.injuries.flatMap((r:any)=>r?.athlete?.displayName?[{id:String(r.id||`${team.id}:${r.athlete.displayName}`),teamId:String(team.id),team:team.displayName,player:r.athlete.displayName,status:typeof r.status==='string'?r.status:'Unknown',reportedAt:date(r.date),bodyPart:r.details?.type||null,expectedReturn:r.details?.returnDate||null,url:safeLink(r.athlete.links?.find((l:any)=>safeLink(l.href))?.href)}]:[]):[]);
 }
 if(kind==='roster'){
  if(!Array.isArray(body?.athletes))throw new Error('Roster format unavailable');
  const all=body.athletes.flatMap((g:any)=>Array.isArray(g?.items)?g.items:[g]);
  return [...new Map(all.flatMap((a:any)=>a?.id&&a.displayName?[[String(a.id),{id:String(a.id),name:a.displayName,position:a.position?.abbreviation||'—',jersey:a.jersey||'—',status:a.status?.name||'Unknown'}] as const]:[])).values()];
 }
 if(!Array.isArray(body?.articles))throw new Error('News format unavailable');
 return body.articles.slice(0,10).flatMap((a:any)=>typeof a?.headline==='string'&&safeLink(a.links?.web?.href)?[{id:String(a.id),headline:a.headline,publishedAt:date(a.published),url:safeLink(a.links.web.href)}]:[]);
}
export async function playerUpdates(league:string,team:string,origin:string,ctx:any){
 if(!Object.hasOwn(PLAYER_LEAGUES,league)|| (team&&!/^\d{1,9}$/.test(team)))throw new Error('Unsupported league or team');
 const path=PLAYER_LEAGUES[league];const cache=(caches as any).default;
 async function read(kind:string,url:string,ttl:number){
  const key=new Request(`${origin}/_source-cache-v2/${league}/${kind}/${kind==='roster'?team:'all'}`);
  const saved=await cache.match(key);if(saved)return saved.json();
  let result:any;
  try {
   const r=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error(`Source returned HTTP ${r.status}`);
   const body:any=await r.json();result={source:'ESPN public feed',sourceUrl:url,checkedAt:new Date().toISOString(),sourceUpdatedAt:date(body.timestamp),rows:normalizePlayers(kind,body),error:null};
  }catch(e){result={source:'ESPN public feed',sourceUrl:url,checkedAt:new Date().toISOString(),sourceUpdatedAt:null,rows:[],error:e instanceof Error?e.message:'Source unavailable'};ttl=60;}
  ctx.waitUntil(cache.put(key,Response.json(result,{headers:{'Cache-Control':`public,max-age=${ttl}`}})));return result;
 }
 const [teams,injuries,news,roster]=await Promise.all([
  read('teams',`https://site.api.espn.com/apis/site/v2/sports/${path}/teams?limit=500`,86400),
  read('injuries',`https://site.api.espn.com/apis/site/v2/sports/${path}/injuries`,300),
  read('news',`https://site.api.espn.com/apis/site/v2/sports/${path}/news?limit=10`,300),
  team?read('roster',`https://site.api.espn.com/apis/site/v2/sports/${path}/teams/${team}/roster`,900):Promise.resolve(null),
 ]);
 return {league,team,teams,injuries,news,roster,notice:'Public source reports, not guaranteed availability or confirmed starting lineups. No automatic probability adjustment.'};
}
