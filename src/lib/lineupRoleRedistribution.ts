import {db} from './db';
import type {ContextProvenance,Market} from './types';
import {normalizePlayerName} from './playerWarehouse';

type AnyRow=Record<string,unknown>;
type GameRow={athleteId:string;sport:string;team:string;eventId:string;minutes?:number;usage?:number;stats:AnyRow};
type InjuryRow={name:string;team?:string;availability:number;status?:string};

const obj=(v:unknown):AnyRow=>v&&typeof v==='object'&&!Array.isArray(v)?v as AnyRow:{};
const num=(v:unknown)=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:undefined;};
const key=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]+/g,'');
const teamKey=(v:string)=>normalizePlayerName(v);
const mean=(xs:number[])=>xs.length?xs.reduce((s,x)=>s+x,0)/xs.length:0;
const clamp=(n:number,min=-1,max=1)=>Math.max(min,Math.min(max,n));
const arr=(payload:unknown):unknown[]=>{
 if(Array.isArray(payload))return payload;
 const root=obj(payload);
 for(const k of ['data','results','events','rows','items'])if(Array.isArray(root[k]))return root[k] as unknown[];
 return [];
};
const statFor=(m:Market)=>{
 if(m.playerContext?.statKey)return key(m.playerContext.statKey);
 const text=(m.market+' '+m.selection).toLowerCase();
 const aliases:Array<[RegExp,string]>=[
  [/passing\s*yards?/,'passingyards'],[/rushing\s*yards?/,'rushingyards'],[/receiving\s*yards?/,'receivingyards'],
  [/receptions?/,'receptions'],[/targets?/,'targets'],[/carries/,'carries'],[/strikeouts?/,'strikeouts'],
  [/total\s*bases?/,'totalbases'],[/home\s*runs?/,'homeruns'],[/\brbi\b/,'rbi'],[/\bhits?\b/,'hits'],
  [/shots?\s*on\s*goal/,'shotsongoal'],[/\bsaves?\b/,'saves'],[/\bgoals?\b/,'goals'],
  [/\bpoints?\b/,'points'],[/rebounds?/,'rebounds'],[/assists?/,'assists']
 ];
 for(const [re,k] of aliases)if(re.test(text))return k;
 return '';
};

function statValue(row:GameRow,statKey:string){
 const stats=obj(row.stats);
 const direct=num(stats[statKey]);
 if(direct!==undefined)return direct;
 for(const [k,v] of Object.entries(stats))if(key(k)===statKey){const n=num(v);if(n!==undefined)return n;}
 return undefined;
}

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
  const r=obj(v);
  const nested=obj(r.player||r.athlete);
  const name=String(r.playerName||r.player_name||r.athleteName||r.athlete_name||nested.name||'').trim();
  const team=String(r.team||r.teamName||r.team_name||nested.team||'').trim()||undefined;
  const status=String(r.status||r.injuryStatus||r.injury_status||'').trim()||undefined;
  const raw=num(r.availability??r.availabilityProbability??r.availability_probability);
  return {name,team,status,availability:clamp(raw??statusAvailability(status||''),0,1)};
 }).filter(x=>x.name&&x.availability<.95);
}

export function deriveRedistributionProfiles(rows:GameRow[]){
 const byTeamEvent=new Map<string,GameRow[]>();
 for(const row of rows){
  if(!row.team||!row.eventId)continue;
  const k=[row.sport,teamKey(row.team),row.eventId].join('|');
  const list=byTeamEvent.get(k)||[];list.push(row);byTeamEvent.set(k,list);
 }
 const byAthlete=new Map<string,GameRow[]>();
 const athletes=new Map<string,{sport:string;team:string;avgMinutes:number;avgUsage:number}>();
 for(const row of rows){
  const list=byAthlete.get(row.athleteId)||[];list.push(row);byAthlete.set(row.athleteId,list);
 }
 for(const [athleteId,games] of byAthlete){
  athletes.set(athleteId,{
   sport:games[0]?.sport||'',team:teamKey(games[0]?.team||''),
   avgMinutes:mean(games.map(x=>x.minutes).filter((x):x is number=>x!==undefined)),
   avgUsage:mean(games.map(x=>x.usage).filter((x):x is number=>x!==undefined))
  });
 }
 const rolePlayers=[...athletes.entries()].filter(([,x])=>x.avgMinutes>=18||x.avgUsage>=.16);
 const profiles:Array<Record<string,unknown>>=[];
 for(const [athleteId,games] of byAthlete){
  const meta=athletes.get(athleteId); if(!meta)continue;
  const statKeys=[...new Set(games.flatMap(g=>Object.keys(obj(g.stats)).map(key)))];
  const teammateIds=rolePlayers.filter(([id,x])=>id!==athleteId&&x.sport===meta.sport&&x.team===meta.team).map(([id])=>id);
  const eventPresence=new Map(games.map(g=>{
   const roster=byTeamEvent.get([g.sport,teamKey(g.team),g.eventId].join('|'))||[];
   return [g.eventId,new Set(roster.map(x=>x.athleteId))] as const;
  }));
  for(const absentAthleteId of teammateIds){
   for(const statKey of statKeys){
    const withRows=games.filter(g=>eventPresence.get(g.eventId)?.has(absentAthleteId)&&statValue(g,statKey)!==undefined);
    const withoutRows=games.filter(g=>!eventPresence.get(g.eventId)?.has(absentAthleteId)&&statValue(g,statKey)!==undefined);
    if(withRows.length<4||withoutRows.length<2)continue;
    const baselineMean=mean(withRows.map(g=>statValue(g,statKey)!).filter(Number.isFinite));
    const absentMean=mean(withoutRows.map(g=>statValue(g,statKey)!).filter(Number.isFinite));
    const minutesWith=mean(withRows.map(x=>x.minutes).filter((x):x is number=>x!==undefined));
    const minutesWithout=mean(withoutRows.map(x=>x.minutes).filter((x):x is number=>x!==undefined));
    const usageWith=mean(withRows.map(x=>x.usage).filter((x):x is number=>x!==undefined));
    const usageWithout=mean(withoutRows.map(x=>x.usage).filter((x):x is number=>x!==undefined));
    const statLift=clamp((absentMean-baselineMean)/Math.max(Math.abs(baselineMean)*.25,1));
    const minutesLift=minutesWith||minutesWithout?clamp((minutesWithout-minutesWith)/Math.max(minutesWith*.2,2)):0;
    const usageLift=usageWith||usageWithout?clamp((usageWithout-usageWith)/Math.max(Math.abs(usageWith)*.25,.03)):0;
    const confidence=clamp(Math.min(withRows.length/20,1)*.45+Math.min(withoutRows.length/8,1)*.55,0,1);
    profiles.push({athleteId,absentAthleteId,sport:meta.sport,teamKey:meta.team,statKey,withGames:withRows.length,withoutGames:withoutRows.length,baselineMean,absentMean,statLift,minutesLift,usageLift,confidence});
   }
  }
 }
 return profiles;
}

export async function rebuildLineupRedistributionProfiles(){
 const sql=db();
 if(!sql)return {configured:false,rowsRead:0,profilesWritten:0,qualifiedProfiles:0};
 const run=await sql`insert into lineup_redistribution_runs(model_version) values(${process.env.MODEL_VERSION||'edgeforce-v61'}) returning id`;
 const runId=Number((run as any[])[0]?.id||0);
 const rows=await sql`
  select pgs.athlete_id as "athleteId",a.sport,coalesce(pgs.team,a.team) as team,pgs.event_id as "eventId",
         pgs.minutes::float as minutes,pgs.usage_rate::float as usage,pgs.stats
  from player_game_stats pgs join athletes a on a.id=pgs.athlete_id
  where pgs.stat_date>now()-interval '730 days' and coalesce(pgs.team,a.team) is not null
  order by pgs.stat_date desc limit 35000
 `;
 const source=(rows as any[]).map(r=>({athleteId:String(r.athleteId),sport:String(r.sport),team:String(r.team),eventId:String(r.eventId),minutes:num(r.minutes),usage:num(r.usage),stats:obj(r.stats)}));
 const profiles=deriveRedistributionProfiles(source);
 let written=0,qualified=0;
 for(const p of profiles as any[]){
  if(p.confidence>=.30)qualified++;
  await sql`
   insert into lineup_redistribution_profiles(
    athlete_id,absent_athlete_id,sport,team_key,stat_key,with_games,without_games,baseline_mean,absent_mean,stat_lift,minutes_lift,usage_lift,confidence,updated_at,metadata
   ) values(
    ${p.athleteId},${p.absentAthleteId},${p.sport},${p.teamKey},${p.statKey},${p.withGames},${p.withoutGames},
    ${p.baselineMean},${p.absentMean},${p.statLift},${p.minutesLift},${p.usageLift},${p.confidence},now(),
    ${sql.json({lookbackDays:730,minWith:4,minWithout:2})}
   )
   on conflict (athlete_id,absent_athlete_id,sport,stat_key) do update set
    team_key=excluded.team_key,with_games=excluded.with_games,without_games=excluded.without_games,
    baseline_mean=excluded.baseline_mean,absent_mean=excluded.absent_mean,stat_lift=excluded.stat_lift,
    minutes_lift=excluded.minutes_lift,usage_lift=excluded.usage_lift,confidence=excluded.confidence,
    updated_at=now(),metadata=excluded.metadata
  `;
  written++;
 }
 if(runId)await sql`
  update lineup_redistribution_runs set rows_read=${rows.length},profiles_written=${written},qualified_profiles=${qualified},
  completed_at=now(),metadata=${sql.json({lookbackDays:730})} where id=${runId}
 `;
 return {configured:true,rowsRead:rows.length,profilesWritten:written,qualifiedProfiles:qualified};
}

async function latestInjuries(){
 const sql=db(); if(!sql)return [] as InjuryRow[];
 const rows=await sql`select payload from injury_context_snapshots where expires_at>now() order by observed_at desc limit 1`;
 return normalizeInjuries((rows as any[])[0]?.payload);
}

export async function enrichMarketsWithLineupRedistribution(markets:Market[]){
 const sql=db();
 const candidates=markets.filter(x=>x.playerContext?.name);
 if(!sql||!candidates.length)return {markets,matched:0,profiles:0,activeAbsences:0};
 const injuries=await latestInjuries();
 if(!injuries.length)return {markets,matched:0,profiles:0,activeAbsences:0};
 const names=[...new Set(candidates.map(x=>normalizePlayerName(x.playerContext!.name)).filter(Boolean))];
 const athletes=await sql`select id,normalized_name as "normalizedName",team,sport from athletes where normalized_name in ${sql(names)}`;
 const byName=new Map((athletes as any[]).map(x=>[String(x.normalizedName),x]));
 const injuredNames=[...new Set(injuries.map(x=>normalizePlayerName(x.name)).filter(Boolean))];
 const injuredAthletes=injuredNames.length?await sql`select id,normalized_name as "normalizedName",team,sport from athletes where normalized_name in ${sql(injuredNames)}`:[];
 const injuryByAthlete=new Map<string,InjuryRow>();
 const injuredByName=new Map(injuries.map(x=>[normalizePlayerName(x.name),x]));
 for(const a of injuredAthletes as any[]){const injury=injuredByName.get(String(a.normalizedName));if(injury)injuryByAthlete.set(String(a.id),injury);}
 const targetIds=[...new Set((athletes as any[]).map(x=>String(x.id)))];
 const absentIds=[...injuryByAthlete.keys()];
 if(!targetIds.length||!absentIds.length)return {markets,matched:0,profiles:0,activeAbsences:injuries.length};
 const profiles=await sql`
  select athlete_id as "athleteId",absent_athlete_id as "absentAthleteId",sport,team_key as "teamKey",stat_key as "statKey",
         with_games as "withGames",without_games as "withoutGames",stat_lift::float as "statLift",
         minutes_lift::float as "minutesLift",usage_lift::float as "usageLift",confidence::float as confidence
  from lineup_redistribution_profiles
  where athlete_id in ${sql(targetIds)} and absent_athlete_id in ${sql(absentIds)}
 `;
 const map=new Map<string,any[]>();
 for(const p of profiles as any[]){const k=[p.athleteId,p.sport,p.statKey].join('|');const list=map.get(k)||[];list.push(p);map.set(k,list);}
 let matched=0;
 const enriched=markets.map(m=>{
  const player=m.playerContext; if(!player?.name)return m;
  const athlete=byName.get(normalizePlayerName(player.name)); if(!athlete)return m;
  const statKey=statFor(m); if(!statKey)return m;
  const options=(map.get([String(athlete.id),m.sport,statKey].join('|'))||[]).filter(p=>{
   const injury=injuryByAthlete.get(String(p.absentAthleteId));
   return injury&&teamKey(String(athlete.team||player.team||''))===String(p.teamKey)&&injury.availability<.95;
  });
  if(!options.length)return m;
  let stat=0,minutes=0,usage=0,weight=0,absenceSeverity=0;
  const details:any[]=[];
  for(const p of options){
   const injury=injuryByAthlete.get(String(p.absentAthleteId))!;
   const severity=1-injury.availability;
   const w=Number(p.confidence||0)*severity;
   if(w<=0)continue;
   stat+=Number(p.statLift||0)*w;minutes+=Number(p.minutesLift||0)*w;usage+=Number(p.usageLift||0)*w;weight+=w;absenceSeverity=Math.max(absenceSeverity,severity);
   details.push({absentAthleteId:String(p.absentAthleteId),status:injury.status,availability:injury.availability,confidence:Number(p.confidence)});
  }
  if(weight<=0)return m;
  const roleConfidence=clamp(weight/Math.max(1,options.length),0,1);
  const sportFeatures={...(m.sportFeatures||{}),roleStatLift:clamp(stat/weight),roleMinutesLift:clamp(minutes/weight),roleUsageLift:clamp(usage/weight),roleRedistributionConfidence:roleConfidence,roleAbsenceSeverity:absenceSeverity};
  const projection=player.projection===undefined?undefined:player.projection*(1+clamp(stat/weight,-.35,.35)*.14*roleConfidence);
  const provenance:ContextProvenance[]=[...(m.contextProvenance||[]),{source:'lineup-redistribution',providerId:'edgeforce-v65-role-engine',field:'player.'+statKey+'.role-redistribution',observedAt:new Date().toISOString(),confidence:.72+.24*roleConfidence,status:'CACHED',detail:{activeAbsences:details,statLift:stat/weight,minutesLift:minutes/weight,usageLift:usage/weight}}];
  matched++;
  return {...m,sportFeatures,playerContext:{...player,...(projection===undefined?{}:{projection})},contextSources:[...new Set([...(m.contextSources||[]),'lineup-redistribution'])],contextProvenance:provenance};
 });
 return {markets:enriched,matched,profiles:(profiles as any[]).length,activeAbsences:injuries.length};
}

export async function loadLineupRedistributionSummary(){
 const sql=db();
 if(!sql)return {configured:false,totalProfiles:0,qualifiedProfiles:0,pairs:0,top:[]};
 const [counts,top]=await Promise.all([
  sql`select count(*)::int as "totalProfiles",count(*) filter(where confidence>=.30)::int as "qualifiedProfiles",count(distinct athlete_id||'|'||absent_athlete_id)::int as pairs from lineup_redistribution_profiles`,
  sql`
   select a.name as "playerName",b.name as "absentPlayer",p.sport,p.stat_key as "statKey",p.with_games as "withGames",p.without_games as "withoutGames",
          p.stat_lift::float as "statLift",p.minutes_lift::float as "minutesLift",p.usage_lift::float as "usageLift",p.confidence::float as confidence
   from lineup_redistribution_profiles p join athletes a on a.id=p.athlete_id join athletes b on b.id=p.absent_athlete_id
   where p.confidence>=.30 order by abs(p.stat_lift)*p.confidence desc limit 30
  `
 ]);
 const c=(counts as any[])[0]||{};
 return {configured:true,totalProfiles:Number(c.totalProfiles||0),qualifiedProfiles:Number(c.qualifiedProfiles||0),pairs:Number(c.pairs||0),top};
}
