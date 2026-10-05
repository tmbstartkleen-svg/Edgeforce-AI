import {db} from './db';
import type {ContextProvenance,Market} from './types';
import {normalizePlayerName} from './playerWarehouse';

type AnyRow=Record<string,unknown>;
type HistoryRow={
 athleteId:string;sport:string;team:string;position?:string|null;starter?:boolean|null;
 minutes?:number|null;usage?:number|null;
};
type InjuryRow={name:string;team?:string;availability:number;status?:string};

export type DepthChartProfile={
 athleteId:string;sport:string;teamKey:string;positionKey:string;games:number;starts:number;
 starterRate:number;averageMinutes:number;averageUsage:number;roleScore:number;depthRank:number;confidence:number;
};

const obj=(v:unknown):AnyRow=>v&&typeof v==='object'&&!Array.isArray(v)?v as AnyRow:{};
const arr=(payload:unknown):unknown[]=>{
 if(Array.isArray(payload))return payload;
 const root=obj(payload);
 for(const k of ['data','results','events','rows','items'])if(Array.isArray(root[k]))return root[k] as unknown[];
 return [];
};
const num=(v:unknown)=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:undefined;};
const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const key=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]+/g,'')||'*';
const teamKey=(v:string)=>normalizePlayerName(v);
const mean=(xs:number[])=>xs.length?xs.reduce((s,x)=>s+x,0)/xs.length:0;

function statusAvailability(status:string){
 const s=status.toLowerCase();
 if(/out|inactive|ir|injured reserve|suspended/.test(s))return 0;
 if(/doubtful/.test(s))return .25;
 if(/questionable|game[- ]?time/.test(s))return .55;
 if(/probable/.test(s))return .85;
 if(/active|available|healthy/.test(s))return 1;
 return .7;
}

function normalizeInjuries(payload:unknown):InjuryRow[]{
 return arr(payload).map(v=>{
  const r=obj(v),nested=obj(r.player||r.athlete);
  const name=String(r.playerName||r.player_name||r.athleteName||r.athlete_name||nested.name||'').trim();
  const team=String(r.team||r.teamName||r.team_name||nested.team||'').trim()||undefined;
  const status=String(r.status||r.injuryStatus||r.injury_status||'').trim()||undefined;
  const raw=num(r.availability??r.availabilityProbability??r.availability_probability);
  return {name,team,status,availability:clamp(raw??statusAvailability(status||''))};
 }).filter(x=>x.name&&x.availability<.99);
}

export function deriveDepthChartProfiles(rows:HistoryRow[]):DepthChartProfile[]{
 const grouped=new Map<string,HistoryRow[]>();
 for(const row of rows){
  if(!row.athleteId||!row.sport||!row.team)continue;
  const list=grouped.get(row.athleteId)||[];list.push(row);grouped.set(row.athleteId,list);
 }
 const raw:DepthChartProfile[]=[];
 for(const [athleteId,games] of grouped){
  const sport=games[0].sport,team=teamKey(games[0].team),position=key(String(games[0].position||'*'));
  const starts=games.filter(x=>x.starter===true).length;
  const explicitStarterGames=games.filter(x=>x.starter!==null&&x.starter!==undefined).length;
  const averageMinutes=mean(games.map(x=>num(x.minutes)).filter((x):x is number=>x!==undefined));
  const averageUsage=mean(games.map(x=>num(x.usage)).filter((x):x is number=>x!==undefined));
  const starterRate=explicitStarterGames?starts/explicitStarterGames:0;
  raw.push({
   athleteId,sport,teamKey:team,positionKey:position,games:games.length,starts,
   starterRate,averageMinutes,averageUsage,roleScore:0,depthRank:99,
   confidence:clamp(games.length/20)*(.65+.35*clamp(explicitStarterGames/Math.max(1,games.length)))
  });
 }
 const teams=new Map<string,DepthChartProfile[]>();
 for(const p of raw){const k=[p.sport,p.teamKey,p.positionKey].join('|');const list=teams.get(k)||[];list.push(p);teams.set(k,list);}
 for(const list of teams.values()){
  const maxMin=Math.max(1,...list.map(x=>x.averageMinutes));
  const maxUsage=Math.max(.01,...list.map(x=>x.averageUsage));
  for(const p of list){
   const minutesScore=clamp(p.averageMinutes/maxMin);
   const usageScore=clamp(p.averageUsage/maxUsage);
   p.roleScore=clamp(p.starterRate*.55+minutesScore*.30+usageScore*.15);
  }
  list.sort((a,b)=>b.roleScore-a.roleScore);
  list.forEach((p,i)=>p.depthRank=i+1);
 }
 return raw;
}

export async function rebuildDepthChartProfiles(){
 const sql=db();
 if(!sql)return {configured:false,rowsRead:0,profilesWritten:0,teamsProfiled:0};
 const run=await sql`insert into depth_chart_runs(model_version) values(${process.env.MODEL_VERSION||'edgeforce-v61'}) returning id`;
 const runId=Number((run as any[])[0]?.id||0);
 const rows=await sql`
  select pgs.athlete_id as "athleteId",a.sport,coalesce(pgs.team,a.team) as team,a.position,
         pgs.starter,pgs.minutes::float as minutes,pgs.usage_rate::float as usage
  from player_game_stats pgs join athletes a on a.id=pgs.athlete_id
  where pgs.stat_date>now()-interval '730 days' and coalesce(pgs.team,a.team) is not null
  order by pgs.stat_date desc limit 40000
 `;
 const profiles=deriveDepthChartProfiles((rows as any[]).map(r=>({
  athleteId:String(r.athleteId),sport:String(r.sport),team:String(r.team),position:r.position?String(r.position):null,
  starter:r.starter===null||r.starter===undefined?null:Boolean(r.starter),minutes:num(r.minutes),usage:num(r.usage)
 })));
 let written=0;
 for(const p of profiles){
  await sql`
   insert into depth_chart_profiles(
    athlete_id,sport,team_key,position_key,games,starts,starter_rate,average_minutes,average_usage,role_score,depth_rank,confidence,updated_at,metadata
   ) values(
    ${p.athleteId},${p.sport},${p.teamKey},${p.positionKey},${p.games},${p.starts},${p.starterRate},
    ${p.averageMinutes},${p.averageUsage},${p.roleScore},${p.depthRank},${p.confidence},now(),
    ${sql.json({lookbackDays:730,explicitStarterSupport:p.starts>0})}
   )
   on conflict (athlete_id) do update set
    sport=excluded.sport,team_key=excluded.team_key,position_key=excluded.position_key,games=excluded.games,
    starts=excluded.starts,starter_rate=excluded.starter_rate,average_minutes=excluded.average_minutes,
    average_usage=excluded.average_usage,role_score=excluded.role_score,depth_rank=excluded.depth_rank,
    confidence=excluded.confidence,updated_at=now(),metadata=excluded.metadata
  `;
  written++;
 }
 const teams=new Set(profiles.map(x=>x.sport+'|'+x.teamKey)).size;
 if(runId)await sql`
  update depth_chart_runs set rows_read=${rows.length},profiles_written=${written},teams_profiled=${teams},
  completed_at=now(),metadata=${sql.json({lookbackDays:730})} where id=${runId}
 `;
 return {configured:true,rowsRead:rows.length,profilesWritten:written,teamsProfiled:teams};
}

async function latestInjuries(){
 const sql=db(); if(!sql)return [] as InjuryRow[];
 const rows=await sql`select payload from injury_context_snapshots where expires_at>now() order by observed_at desc limit 1`;
 return normalizeInjuries((rows as any[])[0]?.payload);
}

export async function enrichMarketsWithStartingLineups(markets:Market[]){
 const sql=db();
 const candidates=markets.filter(x=>x.playerContext?.name);
 if(!sql||!candidates.length)return {markets,matched:0,profiles:0,promotions:0};

 const names=[...new Set(candidates.map(x=>normalizePlayerName(x.playerContext!.name)).filter(Boolean))];
 const athletes=await sql`
  select id,name,normalized_name as "normalizedName",sport,team,position
  from athletes where normalized_name in ${sql(names)}
 `;
 if(!athletes.length)return {markets,matched:0,profiles:0,promotions:0};
 const byName=new Map((athletes as any[]).map(x=>[String(x.normalizedName),x]));
 const targetIds=(athletes as any[]).map(x=>String(x.id));
 const targetProfiles=await sql`
  select athlete_id as "athleteId",sport,team_key as "teamKey",position_key as "positionKey",
         games,starts,starter_rate::float as "starterRate",average_minutes::float as "averageMinutes",
         average_usage::float as "averageUsage",role_score::float as "roleScore",depth_rank as "depthRank",
         confidence::float as confidence
  from depth_chart_profiles where athlete_id in ${sql(targetIds)}
 `;
 const profileById=new Map((targetProfiles as any[]).map(x=>[String(x.athleteId),x]));
 const injuries=await latestInjuries();
 const injuredNames=[...new Set(injuries.map(x=>normalizePlayerName(x.name)).filter(Boolean))];
 const injuredAthletes=injuredNames.length?await sql`
  select id,normalized_name as "normalizedName",sport,team,position from athletes where normalized_name in ${sql(injuredNames)}
 `:[];
 const injuryById=new Map<string,InjuryRow>();
 const injuryByName=new Map(injuries.map(x=>[normalizePlayerName(x.name),x]));
 for(const a of injuredAthletes as any[]){const injury=injuryByName.get(String(a.normalizedName));if(injury)injuryById.set(String(a.id),injury);}
 const injuredIds=[...injuryById.keys()];
 const injuredProfiles=injuredIds.length?await sql`
  select athlete_id as "athleteId",sport,team_key as "teamKey",position_key as "positionKey",
         starter_rate::float as "starterRate",role_score::float as "roleScore",depth_rank as "depthRank",confidence::float as confidence
  from depth_chart_profiles where athlete_id in ${sql(injuredIds)}
 `:[];
 const injuredProfileById=new Map((injuredProfiles as any[]).map(x=>[String(x.athleteId),x]));
 let matched=0,promotions=0;

 const enriched=markets.map(m=>{
  const player=m.playerContext; if(!player?.name)return m;
  const athlete=byName.get(normalizePlayerName(player.name)); if(!athlete)return m;
  const profile=profileById.get(String(athlete.id));
  if(!profile&&player.starter===undefined)return m;
  const liveStarter=player.starter;
  let starterProbability=liveStarter===true?1:liveStarter===false?0:clamp(Number(profile?.starterRate||profile?.roleScore||.5));
  let promotionScore=0;
  let displacedBy:string|undefined;
  if(liveStarter===undefined){
   for(const [injuredId,injury] of injuryById){
    const injured=injuredProfileById.get(injuredId); if(!injured)continue;
    const sameTeam=String(injured.teamKey)===teamKey(String(athlete.team||player.team||''));
    const samePosition=String(injured.positionKey)===key(String(athlete.position||'*'));
    if(!sameTeam||!samePosition||Number(injured.starterRate||0)<.35)continue;
    const candidateRank=Math.max(1,Number(profile?.depthRank||99));
    const rankScore=clamp(1-(candidateRank-1)*.18);
    const severity=1-injury.availability;
    const score=severity*rankScore*clamp(Number(injured.starterRate||0))*.85;
    if(score>promotionScore){promotionScore=score;displacedBy=injuredId;}
   }
   if(promotionScore>0){starterProbability=clamp(starterProbability+(1-starterProbability)*promotionScore);promotions++;}
  }
  const roleConfidence=clamp(Number(profile?.confidence||.45));
  const baselineStarterProbability=clamp(Number(profile?.starterRate??profile?.roleScore??.5));
  const roleDelta=starterProbability-baselineStarterProbability;
  const sportFeatures={
   ...(m.sportFeatures||{}),
   lineupStarterProbability:starterProbability,
   lineupRoleConfidence:roleConfidence,
   lineupPromotionScore:promotionScore,
   lineupDepthRank:Number(profile?.depthRank||99),
   lineupRoleScore:Number(profile?.roleScore||starterProbability),
   lineupStarterDelta:roleDelta
  };
  const projectionScale=Math.max(.82,Math.min(1.18,1+roleDelta*.16*roleConfidence));
  const projection=player.projection===undefined?undefined:player.projection*projectionScale;
  const provenance:ContextProvenance[]=[...(m.contextProvenance||[]),{
   source:'starting-lineup',providerId:'edgeforce-v66-lineup-engine',
   field:'player.lineup-role',observedAt:new Date().toISOString(),
   confidence:.72+.25*roleConfidence,status:liveStarter===undefined?'CACHED':'LIVE',
   detail:{starterProbability,baselineStarterProbability,roleDelta,liveStarter:liveStarter??null,depthRank:Number(profile?.depthRank||99),promotionScore,displacedBy:displacedBy||null}
  }];
  matched++;
  return {
   ...m,sportFeatures,
   playerContext:{...player,...(projection===undefined?{}:{projection}),starter:liveStarter},
   contextSources:[...new Set([...(m.contextSources||[]),'starting-lineup'])],contextProvenance:provenance
  };
 });
 return {markets:enriched,matched,profiles:(targetProfiles as any[]).length,promotions};
}

export async function recordLiveLineupSnapshots(markets:Market[]){
 const sql=db(); if(!sql)return 0;
 const rows=markets.filter(x=>x.playerContext?.name&&(x.playerContext?.starter!==undefined||x.playerContext?.availability!==undefined||x.playerContext?.status));
 if(!rows.length)return 0;
 const names=[...new Set(rows.map(x=>normalizePlayerName(x.playerContext!.name)))];
 const athletes=await sql`select id,normalized_name as "normalizedName" from athletes where normalized_name in ${sql(names)}`;
 const byName=new Map((athletes as any[]).map(x=>[String(x.normalizedName),String(x.id)]));
 let written=0;
 for(const m of rows){
  const p=m.playerContext!,athleteId=byName.get(normalizePlayerName(p.name));
  const team=teamKey(p.team||'');
  await sql`
   insert into live_lineup_snapshots(athlete_id,player_name,sport,team_key,event_id,starter,availability,status,source,observed_at,metadata)
   values(${athleteId||null},${p.name},${m.sport},${team||null},${m.id.split(':')[0]},${p.starter??null},${p.availability??null},${p.status??null},
          'edgeforce-context',now(),${sql.json({contextSources:m.contextSources||[]})})
  `;
  written++;
 }
 return written;
}

export async function loadStartingLineupSummary(){
 const sql=db();
 if(!sql)return {configured:false,totalProfiles:0,teams:0,likelyStarters:0,liveSnapshots:0,top:[]};
 const [counts,top]=await Promise.all([
  sql`
   select
    (select count(*)::int from depth_chart_profiles) as "totalProfiles",
    (select count(distinct sport||'|'||team_key)::int from depth_chart_profiles) as teams,
    (select count(*)::int from depth_chart_profiles where starter_rate>=.5 or role_score>=.72) as "likelyStarters",
    (select count(*)::int from live_lineup_snapshots where observed_at>now()-interval '24 hours') as "liveSnapshots"
  `,
  sql`
   select a.name as "playerName",d.sport,d.team_key as "teamKey",d.position_key as "positionKey",d.games,d.starts,
          d.starter_rate::float as "starterRate",d.average_minutes::float as "averageMinutes",
          d.average_usage::float as "averageUsage",d.role_score::float as "roleScore",d.depth_rank as "depthRank",
          d.confidence::float as confidence
   from depth_chart_profiles d join athletes a on a.id=d.athlete_id
   order by d.role_score desc,d.confidence desc limit 30
  `
 ]);
 const c=(counts as any[])[0]||{};
 return {configured:true,totalProfiles:Number(c.totalProfiles||0),teams:Number(c.teams||0),likelyStarters:Number(c.likelyStarters||0),liveSnapshots:Number(c.liveSnapshots||0),top};
}
