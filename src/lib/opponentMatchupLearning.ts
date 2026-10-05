import {db} from './db';
import type {ContextProvenance,Market} from './types';
import {normalizePlayerName} from './playerWarehouse';

type AnyRow=Record<string,unknown>;
type SourceRow={sport:string;opponent:string;position?:string|null;statDate:string;stats:AnyRow};

export type OpponentMatchupProfile={
 sport:string;opponentKey:string;opponentName:string;positionKey:string;statKey:string;
 sampleSize:number;meanAllowed:number;leagueMean:number;relativeSignal:number;volatility:number;confidence:number;
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

export function buildOpponentMatchupProfiles(rows:SourceRow[]):OpponentMatchupProfile[]{
 const league=new Map<string,number[]>();
 const groups=new Map<string,{sport:string;opponentKey:string;opponentName:string;positionKey:string;statKey:string;values:number[]}>();
 for(const row of rows){
  const opponentKey=teamKey(row.opponent);
  if(!opponentKey)continue;
  const position=key(String(row.position||''))||'*';
  for(const [statKey,value] of numericStats(row.stats)){
   const leagueKey=[row.sport,statKey].join('|');
   const baseline=league.get(leagueKey)||[];baseline.push(value);league.set(leagueKey,baseline);
   for(const positionKey of [...new Set([position,'*'])]){
    const groupKey=[row.sport,opponentKey,positionKey,statKey].join('|');
    const group=groups.get(groupKey)||{sport:row.sport,opponentKey,opponentName:row.opponent,positionKey,statKey,values:[]};
    group.values.push(value);groups.set(groupKey,group);
   }
  }
 }
 const profiles:OpponentMatchupProfile[]=[];
 for(const group of groups.values()){
  const sampleSize=group.values.length;
  const minSample=group.positionKey==='*'?12:6;
  if(sampleSize<minSample)continue;
  const baseline=league.get([group.sport,group.statKey].join('|'))||[];
  if(baseline.length<20)continue;
  const leagueMean=mean(baseline),leagueStd=std(baseline),meanAllowed=mean(group.values);
  const scale=Math.max(leagueStd,Math.abs(leagueMean)*.15,1);
  profiles.push({
   sport:group.sport,opponentKey:group.opponentKey,opponentName:group.opponentName,
   positionKey:group.positionKey,statKey:group.statKey,sampleSize,meanAllowed,leagueMean,
   relativeSignal:clamp((meanAllowed-leagueMean)/scale),
   volatility:clamp(std(group.values)/Math.max(Math.abs(meanAllowed),1),0,1),
   confidence:clamp(sampleSize/(group.positionKey==='*'?60:40),0,1)
  });
 }
 return profiles;
}

export async function rebuildOpponentMatchupProfiles(){
 const sql=db();
 if(!sql)return {configured:false,rowsRead:0,profilesWritten:0,qualifiedProfiles:0};
 const run=await sql`
  insert into opponent_matchup_runs(model_version)
  values(${process.env.MODEL_VERSION||'edgeforce-v61'})
  returning id
 `;
 const runId=Number((run as any[])[0]?.id||0);
 const rows=await sql`
  select a.sport,a.position,pgs.opponent,pgs.stat_date as "statDate",pgs.stats
  from player_game_stats pgs join athletes a on a.id=pgs.athlete_id
  where pgs.opponent is not null and pgs.stat_date>now()-interval '730 days'
  order by pgs.stat_date desc limit 25000
 `;
 const source=(rows as any[]).map(row=>({
  sport:String(row.sport),position:row.position?String(row.position):null,opponent:String(row.opponent),
  statDate:new Date(row.statDate).toISOString(),stats:obj(row.stats)
 })) satisfies SourceRow[];
 const profiles=buildOpponentMatchupProfiles(source);
 let written=0,qualified=0;
 for(const p of profiles){
  if(p.confidence>=.25)qualified++;
  await sql`
   insert into opponent_matchup_profiles(
    sport,opponent_key,opponent_name,position_key,stat_key,sample_size,
    mean_allowed,league_mean,relative_signal,volatility,confidence,updated_at,metadata
   ) values(
    ${p.sport},${p.opponentKey},${p.opponentName},${p.positionKey},${p.statKey},${p.sampleSize},
    ${p.meanAllowed},${p.leagueMean},${p.relativeSignal},${p.volatility},${p.confidence},now(),
    ${sql.json({lookbackDays:730,positionSpecific:p.positionKey!=='*'})}
   )
   on conflict (sport,opponent_key,position_key,stat_key) do update set
    opponent_name=excluded.opponent_name,sample_size=excluded.sample_size,mean_allowed=excluded.mean_allowed,
    league_mean=excluded.league_mean,relative_signal=excluded.relative_signal,
    volatility=excluded.volatility,confidence=excluded.confidence,updated_at=now(),metadata=excluded.metadata
  `;
  written++;
 }
 if(runId)await sql`
  update opponent_matchup_runs
  set rows_read=${rows.length},profiles_written=${written},qualified_profiles=${qualified},
      completed_at=now(),metadata=${sql.json({lookbackDays:730})}
  where id=${runId}
 `;
 return {configured:true,rowsRead:rows.length,profilesWritten:written,qualifiedProfiles:qualified};
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
 if(!sql||!candidates.length)return {markets,matched:0,profiles:0};

 const names=[...new Set(candidates.map(x=>normalizePlayerName(x.playerContext!.name)).filter(Boolean))];
 const athletes=await sql`
  select id,normalized_name as "normalizedName",sport,team,position from athletes
  where normalized_name in ${sql(names)}
 `;
 if(!athletes.length)return {markets,matched:0,profiles:0};
 const byName=new Map((athletes as any[]).map(x=>[String(x.normalizedName),x]));
 const opponentKeys=[...new Set(candidates.map(m=>{
  const a=byName.get(normalizePlayerName(m.playerContext!.name));
  return teamKey(opponentFor(m,m.playerContext?.team||a?.team));
 }).filter(Boolean))];
 const sports=[...new Set(candidates.map(x=>x.sport))];
 if(!opponentKeys.length||!sports.length)return {markets,matched:0,profiles:0};

 const profiles=await sql`
  select sport,opponent_key as "opponentKey",opponent_name as "opponentName",
         position_key as "positionKey",stat_key as "statKey",sample_size as "sampleSize",
         mean_allowed::float as "meanAllowed",league_mean::float as "leagueMean",
         relative_signal::float as "relativeSignal",volatility::float as volatility,confidence::float as confidence
  from opponent_matchup_profiles
  where opponent_key in ${sql(opponentKeys)} and sport in ${sql(sports)}
 `;
 const map=new Map<string,any>();
 for(const p of profiles as any[])map.set([p.sport,p.opponentKey,p.positionKey,p.statKey].join('|'),p);

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
  const p=exact&&Number(exact.sampleSize)>=6?exact:fallback;
  if(!p)return m;
  const confidence=clamp(Number(p.confidence||0),0,1);
  if(confidence<.20)return m;
  const rawSignal=clamp(Number(p.relativeSignal||0)),directionalSignal=rawSignal*direction(m);
  const sportFeatures={
   ...(m.sportFeatures||{}),
   opponentMatchupSignal:directionalSignal,opponentMatchupRaw:rawSignal,
   opponentMatchupConfidence:confidence,opponentMatchupVolatility:clamp(Number(p.volatility||0),0,1),
   opponentMatchupSample:Number(p.sampleSize||0)
  };
  const provenance:ContextProvenance[]=[
   ...(m.contextProvenance||[]),
   {
    source:'opponent-matchup',providerId:'edgeforce-opponent-learning',
    field:'opponent.'+statKey+'.'+String(p.positionKey),observedAt:new Date().toISOString(),
    confidence:.70+.27*confidence,status:'CACHED',
    detail:{opponent,positionKey:String(p.positionKey),sampleSize:Number(p.sampleSize),meanAllowed:Number(p.meanAllowed),leagueMean:Number(p.leagueMean),rawSignal}
   }
  ];
  matched++;
  return {...m,sportFeatures,contextSources:[...new Set([...(m.contextSources||[]),'opponent-matchup'])],contextProvenance:provenance};
 });
 return {markets:enriched,matched,profiles:profiles.length};
}

export async function loadOpponentMatchupSummary(){
 const sql=db();
 if(!sql)return {configured:false,totalProfiles:0,qualifiedProfiles:0,opponents:0,top:[]};
 const [counts,top]=await Promise.all([
  sql`
   select count(*)::int as "totalProfiles",
          count(*) filter(where confidence>=.25)::int as "qualifiedProfiles",
          count(distinct sport||'|'||opponent_key)::int as opponents
   from opponent_matchup_profiles
  `,
  sql`
   select sport,opponent_name as "opponentName",position_key as "positionKey",stat_key as "statKey",
          sample_size as "sampleSize",mean_allowed::float as "meanAllowed",league_mean::float as "leagueMean",
          relative_signal::float as "relativeSignal",volatility::float as volatility,confidence::float as confidence
   from opponent_matchup_profiles
   where confidence>=.25
   order by abs(relative_signal)*confidence desc,sample_size desc
   limit 30
  `
 ]);
 const c=(counts as any[])[0]||{};
 return {configured:true,totalProfiles:Number(c.totalProfiles||0),qualifiedProfiles:Number(c.qualifiedProfiles||0),opponents:Number(c.opponents||0),top};
}
