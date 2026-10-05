import {db} from './db';
import type {ContextProvenance,Market} from './types';
import {normalizePlayerName} from './playerWarehouse';

type SettledRow={
 athleteId:string;
 sport:string;
 statKey:string;
 direction:string;
 modelProbability:number;
 result:'win'|'loss'|'push';
};

export type PlayerCalibrationProfile={
 athleteId:string;
 sport:string;
 statKey:string;
 direction:string;
 sampleSize:number;
 wins:number;
 losses:number;
 pushes:number;
 averageModelProbability:number;
 observedHitRate:number;
 calibrationBias:number;
 confidence:number;
 brierScore:number;
};

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const key=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]+/g,'');
const directionFor=(m:Market)=>{
 const text=(m.market+' '+m.selection).toLowerCase();
 return text.includes('under')?'UNDER':text.includes('over')?'OVER':'OTHER';
};
const statFor=(m:Market)=>{
 if(m.playerContext?.statKey)return key(m.playerContext.statKey);
 const text=(m.market+' '+m.selection).toLowerCase();
 const aliases:Array<[RegExp,string]>=[
  [/passing\s*yards?/,'passingyards'],[/passing\s*(tds?|touchdowns?)/,'passingtds'],
  [/rushing\s*yards?/,'rushingyards'],[/receiving\s*yards?/,'receivingyards'],[/receptions?/,'receptions'],
  [/pitch(?:er|ing).*strikeouts?|strikeouts?/,'strikeouts'],[/total\s*bases?/,'totalbases'],[/home\s*runs?/,'homeruns'],
  [/\brbi\b/,'rbi'],[/\bhits?\b/,'hits'],[/shots?\s*on\s*goal/,'shotsongoal'],[/\bsaves?\b/,'saves'],
  [/\bgoals?\b/,'goals'],[/\bpoints?\b/,'points'],[/rebounds?/,'rebounds'],[/assists?/,'assists'],
  [/\baces?\b/,'aces'],[/double\s*faults?/,'doublefaults'],[/games?\s*won/,'gameswon'],[/sets?\s*won/,'setswon']
 ];
 for(const [re,k] of aliases)if(re.test(text))return k;
 return '';
};

export function buildPlayerCalibrationProfile(rows:SettledRow[]):PlayerCalibrationProfile|null{
 const graded=rows.filter(x=>x.result==='win'||x.result==='loss');
 if(!graded.length)return null;
 const wins=graded.filter(x=>x.result==='win').length;
 const losses=graded.length-wins;
 const pushes=rows.length-graded.length;
 const averageModelProbability=graded.reduce((s,x)=>s+x.modelProbability,0)/graded.length;
 const observedRaw=wins/graded.length;
 const priorWeight=12;
 const observedHitRate=(wins+averageModelProbability*priorWeight)/(graded.length+priorWeight);
 const rawBias=observedHitRate-averageModelProbability;
 const confidence=clamp(graded.length/40,0,1);
 const calibrationBias=clamp(rawBias*confidence,-.06,.06);
 const brierScore=graded.reduce((s,x)=>{
  const y=x.result==='win'?1:0;
  return s+(x.modelProbability-y)**2;
 },0)/graded.length;
 const first=rows[0];
 return {
  athleteId:first.athleteId,sport:first.sport,statKey:first.statKey,direction:first.direction,
  sampleSize:graded.length,wins,losses,pushes,averageModelProbability,observedHitRate,calibrationBias,confidence,brierScore
 };
}

export async function rebuildPlayerCalibrationProfiles(){
 const sql=db();
 if(!sql)return {configured:false,rowsRead:0,profilesWritten:0,qualifiedProfiles:0};
 const run=await sql`
  insert into player_calibration_runs(model_version)
  values(${process.env.MODEL_VERSION||'edgeforce-v61'})
  returning id
 `;
 const runId=Number((run as any[])[0]?.id||0);
 const rows=await sql`
  select athlete_id as "athleteId",sport,coalesce(stat_key,'unknown') as "statKey",direction,
         coalesce(sim_probability,model_probability)::float as "modelProbability",result
  from player_prop_predictions
  where athlete_id is not null and result in ('win','loss','push')
  order by settled_at asc
 `;
 const grouped=new Map<string,SettledRow[]>();
 for(const row of rows as any[]){
  const normalized:SettledRow={
   athleteId:String(row.athleteId),sport:String(row.sport),statKey:String(row.statKey),
   direction:String(row.direction),modelProbability:clamp(Number(row.modelProbability||.5),.01,.99),
   result:row.result
  };
  const k=[normalized.athleteId,normalized.sport,normalized.statKey,normalized.direction].join('|');
  const list=grouped.get(k)||[]; list.push(normalized); grouped.set(k,list);
 }
 let profilesWritten=0,qualifiedProfiles=0;
 for(const group of grouped.values()){
  const p=buildPlayerCalibrationProfile(group);
  if(!p)continue;
  if(p.sampleSize>=8)qualifiedProfiles++;
  await sql`
   insert into player_calibration_profiles(
    athlete_id,sport,stat_key,direction,sample_size,wins,losses,pushes,
    average_model_probability,observed_hit_rate,calibration_bias,confidence,brier_score,updated_at,metadata
   ) values(
    ${p.athleteId},${p.sport},${p.statKey},${p.direction},${p.sampleSize},${p.wins},${p.losses},${p.pushes},
    ${p.averageModelProbability},${p.observedHitRate},${p.calibrationBias},${p.confidence},${p.brierScore},now(),
    ${sql.json({shrinkagePrior:12,minRuntimeSample:8,maxBias:.06})}
   )
   on conflict (athlete_id,sport,stat_key,direction) do update set
    sample_size=excluded.sample_size,wins=excluded.wins,losses=excluded.losses,pushes=excluded.pushes,
    average_model_probability=excluded.average_model_probability,observed_hit_rate=excluded.observed_hit_rate,
    calibration_bias=excluded.calibration_bias,confidence=excluded.confidence,brier_score=excluded.brier_score,
    updated_at=now(),metadata=excluded.metadata
  `;
  profilesWritten++;
 }
 if(runId)await sql`
  update player_calibration_runs
  set rows_read=${rows.length},profiles_written=${profilesWritten},qualified_profiles=${qualifiedProfiles},
      completed_at=now(),metadata=${sql.json({groups:grouped.size})}
  where id=${runId}
 `;
 return {configured:true,rowsRead:rows.length,profilesWritten,qualifiedProfiles};
}

export async function enrichMarketsWithPlayerCalibration(markets:Market[]){
 const sql=db();
 const candidates=markets.filter(x=>x.playerContext?.name);
 if(!sql||!candidates.length)return {markets,matched:0,profiles:0};

 const names=[...new Set(candidates.map(x=>normalizePlayerName(x.playerContext!.name)).filter(Boolean))];
 const athletes=await sql`
  select id,normalized_name as "normalizedName"
  from athletes
  where normalized_name in ${sql(names)}
 `;
 if(!athletes.length)return {markets,matched:0,profiles:0};
 const byName=new Map((athletes as any[]).map(x=>[String(x.normalizedName),String(x.id)]));
 const ids=[...new Set([...byName.values()])];
 const profiles=await sql`
  select athlete_id as "athleteId",sport,stat_key as "statKey",direction,
         sample_size as "sampleSize",calibration_bias::float as "calibrationBias",
         confidence::float as confidence,brier_score::float as "brierScore",
         observed_hit_rate::float as "observedHitRate",average_model_probability::float as "averageModelProbability"
  from player_calibration_profiles
  where athlete_id in ${sql(ids)}
 `;
 const map=new Map<string,any>();
 for(const p of profiles as any[])map.set([p.athleteId,p.sport,p.statKey,p.direction].join('|'),p);

 let matched=0;
 const enriched=markets.map(m=>{
  const player=m.playerContext;
  if(!player?.name)return m;
  const athleteId=byName.get(normalizePlayerName(player.name));
  if(!athleteId)return m;
  const statKey=statFor(m);
  const direction=directionFor(m);
  const p=map.get([athleteId,m.sport,statKey,direction].join('|'));
  if(!p||Number(p.sampleSize)<8)return m;
  const bias=clamp(Number(p.calibrationBias||0),-.06,.06);
  const confidence=clamp(Number(p.confidence||0),0,1);
  const sportFeatures={
   ...(m.sportFeatures||{}),
   playerCalibrationBias:bias,
   playerCalibrationConfidence:confidence,
   playerCalibrationSample:Number(p.sampleSize||0),
   playerCalibrationBrier:Number(p.brierScore||0)
  };
  const provenance:ContextProvenance[]=[
   ...(m.contextProvenance||[]),
   {
    source:'player-calibration',
    providerId:'edgeforce-player-calibration',
    field:'player.'+statKey+'.'+direction.toLowerCase()+'.calibration',
    observedAt:new Date().toISOString(),
    confidence:.72+.25*confidence,status:'CACHED',
    detail:{sampleSize:Number(p.sampleSize),bias,observedHitRate:Number(p.observedHitRate),averageModelProbability:Number(p.averageModelProbability)}
   }
  ];
  matched++;
  return {
   ...m,sportFeatures,
   contextSources:[...new Set([...(m.contextSources||[]),'player-calibration'])],
   contextProvenance:provenance
  };
 });
 return {markets:enriched,matched,profiles:profiles.length};
}

export async function loadPlayerCalibrationSummary(){
 const sql=db();
 if(!sql)return {configured:false,totalProfiles:0,qualifiedProfiles:0,totalSamples:0,top:[]};
 const [counts,top]=await Promise.all([
  sql`
   select count(*)::int as "totalProfiles",
          count(*) filter(where sample_size>=8)::int as "qualifiedProfiles",
          coalesce(sum(sample_size),0)::int as "totalSamples"
   from player_calibration_profiles
  `,
  sql`
   select a.name as "playerName",p.sport,p.stat_key as "statKey",p.direction,
          p.sample_size as "sampleSize",p.observed_hit_rate::float as "observedHitRate",
          p.average_model_probability::float as "averageModelProbability",
          p.calibration_bias::float as "calibrationBias",p.confidence::float as confidence,p.brier_score::float as "brierScore"
   from player_calibration_profiles p
   join athletes a on a.id=p.athlete_id
   where p.sample_size>=8
   order by abs(p.calibration_bias) desc,p.sample_size desc
   limit 30
  `
 ]);
 const c=(counts as any[])[0]||{};
 return {configured:true,totalProfiles:Number(c.totalProfiles||0),qualifiedProfiles:Number(c.qualifiedProfiles||0),totalSamples:Number(c.totalSamples||0),top};
}
