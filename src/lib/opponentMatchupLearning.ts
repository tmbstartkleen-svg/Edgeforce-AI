import {db} from './db';
import type {ContextProvenance,Market} from './types';
import {normalizePlayerName} from './playerWarehouse';

type AnyRow=Record<string,unknown>;
type SourceRow={athleteId:string;sport:string;opponent:string;position?:string|null;statDate:string;stats:AnyRow};
type Observation={athleteId:string;sport:string;opponentKey:string;opponentName:string;positionKey:string;statKey:string;value:number};
type Baseline={sampleSize:number;mean:number;stdDev:number};

export type OpponentMatchupProfile={
 sport:string;opponentKey:string;opponentName:string;positionKey:string;statKey:string;
 sampleSize:number;athleteCount:number;meanAllowed:number;leagueMean:number;relativeSignal:number;volatility:number;confidence:number;
};

export type PlayerOpponentMatchupProfile={
 athleteId:string;sport:string;opponentKey:string;opponentName:string;statKey:string;
 sampleSize:number;baselineMean:number;opponentMean:number;relativeSignal:number;confidence:number;
};

const obj=(v:unknown):AnyRow=>v&&typeof v==='object'&&!Array.isArray(v)?v as AnyRow:{};
const num=(v:unknown)=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:undefined;};
const clamp=(n:number,min=-1,max=1)=>Math.max(min,Math.min(max,n));
const key=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]+/g,'');
const teamKey=(v:string)=>normalizePlayerName(v);
const mean=(xs:number[])=>xs.length?xs.reduce((s,x)=>s+x,0)/xs.length:0;
const std=(xs:number[])=>{if(xs.length<2)return 0;const m=mean(xs);return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/xs.length);};
const direction=(m:Market)=>{const t=(m.market+' '+m.selection).toLowerCase();return t.includes('under')?-1:t.includes('over')?1:0;};
const statFor=(m:Market)=>{
 if(m.playerContext?.statKey)return key(m.playerContext.statKey);
 const text=(m.market+' '+m.selection).toLowerCase();
 const aliases:Array<[RegExp,string]>=[
  [/passing\s*yards?/,'passingyards'],[/passing\s*(tds?|touchdowns?)/,'passingtds'],
  [/rushing\s*yards?/,'rushingyards'],[/receiving\s*yards?/,'receivingyards'],[/receptions?/,'receptions'],
  [/targets?/,'targets'],[/carries/,'carries'],[/pitch(?:er|ing).*strikeouts?|strikeouts?/,'strikeouts'],
  [/total\s*bases?/,'totalbases'],[/home\s*runs?/,'homeruns'],[/\brbi\b/,'rbi'],[/\bhits?\b/,'hits'],
  [/shots?\s*on\s*goal/,'shotsongoal'],[/\bsaves?\b/,'saves'],[/\bgoals?\b/,'goals'],
  [/\bpoints?\b/,'points'],[/rebounds?/,'rebounds'],[/assists?/,'assists'],
  [/three[- ]?pointers?|3[- ]?pointers?|threes?/,'threepointers'],
  [/\baces?\b/,'aces'],[/double\s*faults?/,'doublefaults'],[/games?\s*won/,'gameswon'],[/sets?\s*won/,'setswon']
 ];
 for(const [re,k] of aliases)if(re.test(text))return k;
 return '';
};

function numericStats(stats:AnyRow){
 const out:Array<[string,number]>=[];
 for(const [raw,value] of Object.entries(stats)){
  const n=num(value),k=key(raw);
  if(!k||n===undefined||Math.abs(n)>1000000)continue;
  out.push([k,n]);
 }
 return out;
}

function observations(rows:SourceRow[]):Observation[]{
 const out:Observation[]=[];
 for(const row of rows){
  const opponentKey=teamKey(row.opponent);
  if(!row.athleteId||!opponentKey)continue;
  const positionKey=key(String(row.position||''))||'*';
  for(const [statKey,value] of numericStats(row.stats)){
   out.push({athleteId:row.athleteId,sport:row.sport,opponentKey,opponentName:row.opponent,positionKey,statKey,value});
  }
 }
 return out;
}

function athleteBaselines(source:Observation[]){
 const grouped=new Map<string,number[]>();
 for(const row of source){
  const k=[row.athleteId,row.sport,row.statKey].join('|');
  const values=grouped.get(k)||[];values.push(row.value);grouped.set(k,values);
 }
 const out=new Map<string,Baseline>();
 for(const [k,values] of grouped)out.set(k,{sampleSize:values.length,mean:mean(values),stdDev:std(values)});
 return out;
}

function normalizedResidual(value:number,baseline:Baseline){
 const scale=Math.max(baseline.stdDev,Math.abs(baseline.mean)*.18,1);
 return clamp((value-baseline.mean)/scale,-2,2);
}

export function buildOpponentMatchupProfiles(rows:SourceRow[]):OpponentMatchupProfile[]{
 const source=observations(rows);
 const baselines=athleteBaselines(source);
 const league=new Map<string,number[]>();
 const groups=new Map<string,{sport:string;opponentKey:string;opponentName:string;positionKey:string;statKey:string;values:number[];residuals:number[];athletes:Set<string>}>();

 for(const row of source){
  const baseline=baselines.get([row.athleteId,row.sport,row.statKey].join('|'));
  if(!baseline||baseline.sampleSize<3)continue;
  const leagueKey=[row.sport,row.statKey].join('|');
  const leagueValues=league.get(leagueKey)||[];leagueValues.push(row.value);league.set(leagueKey,leagueValues);
  const residual=normalizedResidual(row.value,baseline);
  for(const positionKey of [...new Set([row.positionKey,'*'])]){
   const groupKey=[row.sport,row.opponentKey,positionKey,row.statKey].join('|');
   const group=groups.get(groupKey)||{sport:row.sport,opponentKey:row.opponentKey,opponentName:row.opponentName,positionKey,statKey:row.statKey,values:[],residuals:[],athletes:new Set<string>()};
   group.values.push(row.value);group.residuals.push(residual);group.athletes.add(row.athleteId);groups.set(groupKey,group);
  }
 }

 const profiles:OpponentMatchupProfile[]=[];
 for(const group of groups.values()){
  const sampleSize=group.values.length;
  const minSample=group.positionKey==='*'?12:6;
  if(sampleSize<minSample)continue;
  const baseline=league.get([group.sport,group.statKey].join('|'))||[];
  if(baseline.length<20)continue;
  const athleteCount=group.athletes.size;
  const sampleTarget=group.positionKey==='*'?60:40;
  const diversityTarget=group.positionKey==='*'?8:5;
  const sampleConfidence=clamp(sampleSize/sampleTarget,0,1);
  const diversityConfidence=.65+.35*clamp(athleteCount/diversityTarget,0,1);
  const meanAllowed=mean(group.values),leagueMean=mean(baseline);
  profiles.push({
   sport:group.sport,opponentKey:group.opponentKey,opponentName:group.opponentName,
   positionKey:group.positionKey,statKey:group.statKey,sampleSize,athleteCount,meanAllowed,leagueMean,
   relativeSignal:clamp(mean(group.residuals)),
   volatility:clamp(std(group.values)/Math.max(Math.abs(meanAllowed),1),0,1),
   confidence:clamp(sampleConfidence*diversityConfidence,0,1)
  });
 }
 return profiles;
}

export function buildPlayerOpponentProfiles(rows:SourceRow[]):PlayerOpponentMatchupProfile[]{
 const source=observations(rows);
 const baselines=athleteBaselines(source);
 const groups=new Map<string,{athleteId:string;sport:string;opponentKey:string;opponentName:string;statKey:string;values:number[]}>();
 for(const row of source){
  const k=[row.athleteId,row.sport,row.opponentKey,row.statKey].join('|');
  const group=groups.get(k)||{athleteId:row.athleteId,sport:row.sport,opponentKey:row.opponentKey,opponentName:row.opponentName,statKey:row.statKey,values:[]};
  group.values.push(row.value);groups.set(k,group);
 }
 const profiles:PlayerOpponentMatchupProfile[]=[];
 for(const group of groups.values()){
  if(group.values.length<2)continue;
  const baseline=baselines.get([group.athleteId,group.sport,group.statKey].join('|'));
  if(!baseline||baseline.sampleSize<5)continue;
  const opponentMean=mean(group.values);
  const scale=Math.max(baseline.stdDev,Math.abs(baseline.mean)*.18,1);
  const sampleConfidence=clamp(group.values.length/8,0,1);
  const baselineConfidence=.60+.40*clamp(baseline.sampleSize/20,0,1);
  profiles.push({
   athleteId:group.athleteId,sport:group.sport,opponentKey:group.opponentKey,opponentName:group.opponentName,
   statKey:group.statKey,sampleSize:group.values.length,baselineMean:baseline.mean,opponentMean,
   relativeSignal:clamp((opponentMean-baseline.mean)/scale),
   confidence:clamp(sampleConfidence*baselineConfidence,0,1)
  });
 }
 return profiles;
}

export async function rebuildOpponentMatchupProfiles(){
 const sql=db();
 if(!sql)return {configured:false,rowsRead:0,profilesWritten:0,qualifiedProfiles:0,playerProfilesWritten:0,qualifiedPlayerProfiles:0};
 const run=await sql`
  insert into opponent_matchup_runs(model_version)
  values(${process.env.MODEL_VERSION||'edgeforce-v61'})
  returning id
 `;
 const runId=Number((run as any[])[0]?.id||0);
 const rows=await sql`
  select pgs.athlete_id as "athleteId",a.sport,a.position,pgs.opponent,pgs.stat_date as "statDate",pgs.stats
  from player_game_stats pgs join athletes a on a.id=pgs.athlete_id
  where pgs.opponent is not null and pgs.stat_date>now()-interval '730 days'
  order by pgs.stat_date desc limit 25000
 `;
 const source=(rows as any[]).map(row=>({
  athleteId:String(row.athleteId),sport:String(row.sport),position:row.position?String(row.position):null,
  opponent:String(row.opponent),statDate:new Date(row.statDate).toISOString(),stats:obj(row.stats)
 })) satisfies SourceRow[];
 const profiles=buildOpponentMatchupProfiles(source);
 const playerProfiles=buildPlayerOpponentProfiles(source);
 let written=0,qualified=0,playerWritten=0,playerQualified=0;

 for(const p of profiles){
  if(p.confidence>=.20)qualified++;
  await sql`
   insert into opponent_matchup_profiles(
    sport,opponent_key,opponent_name,position_key,stat_key,sample_size,athlete_count,
    mean_allowed,league_mean,relative_signal,volatility,confidence,updated_at,metadata
   ) values(
    ${p.sport},${p.opponentKey},${p.opponentName},${p.positionKey},${p.statKey},${p.sampleSize},${p.athleteCount},
    ${p.meanAllowed},${p.leagueMean},${p.relativeSignal},${p.volatility},${p.confidence},now(),
    ${sql.json({lookbackDays:730,positionSpecific:p.positionKey!=='*',baselineAdjusted:true})}
   )
   on conflict (sport,opponent_key,position_key,stat_key) do update set
    opponent_name=excluded.opponent_name,sample_size=excluded.sample_size,athlete_count=excluded.athlete_count,
    mean_allowed=excluded.mean_allowed,league_mean=excluded.league_mean,relative_signal=excluded.relative_signal,
    volatility=excluded.volatility,confidence=excluded.confidence,updated_at=now(),metadata=excluded.metadata
  `;
  written++;
 }

 for(const p of playerProfiles){
  if(p.confidence>=.20)playerQualified++;
  await sql`
   insert into player_opponent_matchup_profiles(
    athlete_id,sport,opponent_key,opponent_name,stat_key,sample_size,
    baseline_mean,opponent_mean,relative_signal,confidence,updated_at,metadata
   ) values(
    ${p.athleteId},${p.sport},${p.opponentKey},${p.opponentName},${p.statKey},${p.sampleSize},
    ${p.baselineMean},${p.opponentMean},${p.relativeSignal},${p.confidence},now(),
    ${sql.json({lookbackDays:730,minOpponentGames:2,baselineAdjusted:true})}
   )
   on conflict (athlete_id,sport,opponent_key,stat_key) do update set
    opponent_name=excluded.opponent_name,sample_size=excluded.sample_size,baseline_mean=excluded.baseline_mean,
    opponent_mean=excluded.opponent_mean,relative_signal=excluded.relative_signal,
    confidence=excluded.confidence,updated_at=now(),metadata=excluded.metadata
  `;
  playerWritten++;
 }

 if(runId)await sql`
  update opponent_matchup_runs
  set rows_read=${rows.length},profiles_written=${written},qualified_profiles=${qualified},
      player_profiles_written=${playerWritten},qualified_player_profiles=${playerQualified},
      completed_at=now(),metadata=${sql.json({lookbackDays:730,baselineAdjusted:true})}
  where id=${runId}
 `;
 return {configured:true,rowsRead:rows.length,profilesWritten:written,qualifiedProfiles:qualified,playerProfilesWritten:playerWritten,qualifiedPlayerProfiles:playerQualified};
}

function sameTeam(a?:string|null,b?:string|null){return Boolean(a&&b&&teamKey(a)===teamKey(b));}
function opponentFor(m:Market,team?:string|null){
 if(team&&sameTeam(team,m.home))return m.away;
 if(team&&sameTeam(team,m.away))return m.home;
 return '';
}

export async function enrichMarketsWithOpponentMatchups(markets:Market[]){
 const sql=db();
 const candidates=markets.filter(x=>x.playerContext?.name);
 if(!sql||!candidates.length)return {markets,matched:0,profiles:0,playerProfiles:0};

 const names=[...new Set(candidates.map(x=>normalizePlayerName(x.playerContext!.name)).filter(Boolean))];
 const athletes=await sql`
  select id,normalized_name as "normalizedName",sport,team,position from athletes
  where normalized_name in ${sql(names)}
 `;
 if(!athletes.length)return {markets,matched:0,profiles:0,playerProfiles:0};
 const byName=new Map((athletes as any[]).map(x=>[String(x.normalizedName),x]));
 const opponentKeys=[...new Set(candidates.map(m=>{
  const a=byName.get(normalizePlayerName(m.playerContext!.name));
  return teamKey(opponentFor(m,m.playerContext?.team||a?.team));
 }).filter(Boolean))];
 const sports=[...new Set(candidates.map(x=>x.sport))];
 const athleteIds=[...new Set((athletes as any[]).map(x=>String(x.id)))];
 if(!opponentKeys.length||!sports.length)return {markets,matched:0,profiles:0,playerProfiles:0};

 const [profiles,playerProfiles]=await Promise.all([
  sql`
   select sport,opponent_key as "opponentKey",opponent_name as "opponentName",
          position_key as "positionKey",stat_key as "statKey",sample_size as "sampleSize",
          athlete_count as "athleteCount",mean_allowed::float as "meanAllowed",league_mean::float as "leagueMean",
          relative_signal::float as "relativeSignal",volatility::float as volatility,confidence::float as confidence
   from opponent_matchup_profiles
   where opponent_key in ${sql(opponentKeys)} and sport in ${sql(sports)}
  `,
  sql`
   select athlete_id as "athleteId",sport,opponent_key as "opponentKey",opponent_name as "opponentName",
          stat_key as "statKey",sample_size as "sampleSize",baseline_mean::float as "baselineMean",
          opponent_mean::float as "opponentMean",relative_signal::float as "relativeSignal",confidence::float as confidence
   from player_opponent_matchup_profiles
   where athlete_id in ${sql(athleteIds)} and opponent_key in ${sql(opponentKeys)} and sport in ${sql(sports)}
  `
 ]);
 const map=new Map<string,any>();
 for(const p of profiles as any[])map.set([p.sport,p.opponentKey,p.positionKey,p.statKey].join('|'),p);
 const playerMap=new Map<string,any>();
 for(const p of playerProfiles as any[])playerMap.set([p.athleteId,p.sport,p.opponentKey,p.statKey].join('|'),p);

 let matched=0;
 const enriched=markets.map(m=>{
  const player=m.playerContext;
  if(!player?.name)return m;
  const athlete=byName.get(normalizePlayerName(player.name));
  if(!athlete)return m;
  const opponent=opponentFor(m,player.team||athlete.team),opponentKey=teamKey(opponent),statKey=statFor(m);
  if(!opponentKey||!statKey)return m;
  const positionKey=key(String(athlete.position||''))||'*';
  const exact=map.get([m.sport,opponentKey,positionKey,statKey].join('|'));
  const fallback=map.get([m.sport,opponentKey,'*',statKey].join('|'));
  const playerProfile=playerMap.get([String(athlete.id),m.sport,opponentKey,statKey].join('|'));

  const fallbackConfidence=clamp(Number(fallback?.confidence||0),0,1);
  const exactConfidence=clamp(Number(exact?.confidence||0),0,1);
  const hasExact=Boolean(exact&&exactConfidence>=.10);
  const hasFallback=Boolean(fallback&&fallbackConfidence>=.10);
  const playerConfidence=clamp(Number(playerProfile?.confidence||0),0,1);
  const hasPlayer=Boolean(playerProfile&&playerConfidence>=.15);
  if(!hasExact&&!hasFallback&&!hasPlayer)return m;

  const fallbackSignal=hasFallback?clamp(Number(fallback.relativeSignal||0)):0;
  const exactSignal=hasExact?clamp(Number(exact.relativeSignal||0)):fallbackSignal;
  const defenseParts=hasExact
   ? [{signal:fallbackSignal,confidence:fallbackConfidence,weight:.35},{signal:exactSignal,confidence:exactConfidence,weight:.65}]
   : [{signal:fallbackSignal,confidence:fallbackConfidence,weight:1}];
  const defenseDenom=defenseParts.reduce((s,x)=>s+x.weight*x.confidence,0);
  const defenseSignal=defenseDenom>0
   ? clamp(defenseParts.reduce((s,x)=>s+x.signal*x.weight*x.confidence,0)/defenseDenom)
   : 0;
  const defenseConfidence=clamp(defenseDenom,0,1);
  const playerRaw=hasPlayer?clamp(Number(playerProfile.relativeSignal||0)):0;
  const dir=direction(m);
  const volatility=clamp(Number((hasExact?exact:fallback)?.volatility||0),0,1);

  const sportFeatures={
   ...(m.sportFeatures||{}),
   opponentDefenseTendency:fallbackSignal,
   opponentDefenseConfidence:fallbackConfidence,
   positionMatchupStrength:exactSignal,
   positionMatchupConfidence:hasExact?exactConfidence:fallbackConfidence,
   opponentMatchupSignal:defenseSignal*dir,
   opponentMatchupRaw:defenseSignal,
   opponentMatchupConfidence:defenseConfidence,
   opponentMatchupVolatility:volatility,
   opponentMatchupSample:Number((hasExact?exact:fallback)?.sampleSize||0),
   playerVsOpponentAdjustment:playerRaw,
   playerVsOpponentSignal:playerRaw*dir,
   playerVsOpponentConfidence:playerConfidence,
   playerVsOpponentSample:Number(playerProfile?.sampleSize||0)
  };
  const provenance:ContextProvenance[]=[
   ...(m.contextProvenance||[]),
   {
    source:'opponent-matchup',providerId:'edgeforce-opponent-learning',
    field:'opponent.'+statKey+'.'+positionKey+'.matchup-stack',observedAt:new Date().toISOString(),
    confidence:.70+.27*Math.max(defenseConfidence,playerConfidence),status:'CACHED',
    detail:{
     opponent,positionKey,teamSignal:fallbackSignal,positionSignal:exactSignal,
     playerVsOpponentSignal:playerRaw,defenseConfidence,playerConfidence,
     defenseSample:Number((hasExact?exact:fallback)?.sampleSize||0),
     playerSample:Number(playerProfile?.sampleSize||0),baselineAdjusted:true
    }
   }
  ];
  matched++;
  return {...m,sportFeatures,contextSources:[...new Set([...(m.contextSources||[]),'opponent-matchup'])],contextProvenance:provenance};
 });
 return {markets:enriched,matched,profiles:(profiles as any[]).length,playerProfiles:(playerProfiles as any[]).length};
}

export async function loadOpponentMatchupSummary(){
 const sql=db();
 if(!sql)return {configured:false,totalProfiles:0,qualifiedProfiles:0,playerProfiles:0,qualifiedPlayerProfiles:0,opponents:0,top:[],topPlayers:[]};
 const [counts,top,topPlayers]=await Promise.all([
  sql`
   select
    (select count(*)::int from opponent_matchup_profiles) as "totalProfiles",
    (select count(*)::int from opponent_matchup_profiles where confidence>=.20) as "qualifiedProfiles",
    (select count(*)::int from player_opponent_matchup_profiles) as "playerProfiles",
    (select count(*)::int from player_opponent_matchup_profiles where confidence>=.20) as "qualifiedPlayerProfiles",
    (select count(distinct sport||'|'||opponent_key)::int from opponent_matchup_profiles) as opponents
  `,
  sql`
   select sport,opponent_name as "opponentName",position_key as "positionKey",stat_key as "statKey",
          sample_size as "sampleSize",athlete_count as "athleteCount",mean_allowed::float as "meanAllowed",
          league_mean::float as "leagueMean",relative_signal::float as "relativeSignal",
          volatility::float as volatility,confidence::float as confidence
   from opponent_matchup_profiles
   where confidence>=.20
   order by abs(relative_signal)*confidence desc,sample_size desc
   limit 30
  `,
  sql`
   select a.name as "playerName",p.sport,p.opponent_name as "opponentName",p.stat_key as "statKey",
          p.sample_size as "sampleSize",p.baseline_mean::float as "baselineMean",
          p.opponent_mean::float as "opponentMean",p.relative_signal::float as "relativeSignal",
          p.confidence::float as confidence
   from player_opponent_matchup_profiles p
   join athletes a on a.id=p.athlete_id
   where p.confidence>=.20
   order by abs(p.relative_signal)*p.confidence desc,p.sample_size desc
   limit 30
  `
 ]);
 const c=(counts as any[])[0]||{};
 return {
  configured:true,totalProfiles:Number(c.totalProfiles||0),qualifiedProfiles:Number(c.qualifiedProfiles||0),
  playerProfiles:Number(c.playerProfiles||0),qualifiedPlayerProfiles:Number(c.qualifiedPlayerProfiles||0),
  opponents:Number(c.opponents||0),top,topPlayers
 };
}
