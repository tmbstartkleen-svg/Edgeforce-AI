import {db} from './db';

export type OptimizerWeights={councilWeight:number;simulationWeight:number;marketWeight:number};
export type OptimizerRow={
 occurredAt:string;sport:string;marketKey:string;
 councilProbability:number;simulationProbability:number;marketProbability:number;outcome:0|1;
};
export type OptimizerProfile=OptimizerWeights&{
 sport:string;marketKey:string;scope:'GLOBAL'|'SPORT'|'SPORT_MARKET';
 sampleCount:number;trainCount:number;holdoutCount:number;
 priorCouncilWeight:number;priorSimulationWeight:number;priorMarketWeight:number;
 trainBrier:number;holdoutBrier:number;baselineHoldoutBrier:number;
 holdoutLogLoss:number;baselineHoldoutLogLoss:number;holdoutBrierGain:number;
 confidence:number;promoted:boolean;reason:string;
};
export type OptimizerProfileMap=Record<string,OptimizerProfile>;

const SAFE_BASELINE:OptimizerWeights={councilWeight:0,simulationWeight:1,marketWeight:0};
const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const safeProb=(n:number)=>clamp(n,.001,.999);
const keyPart=(s:string)=>String(s||'').trim().toUpperCase();
export const optimizerProfileKey=(sport:string,marketKey:string)=>`${keyPart(sport)}|${String(marketKey||'').trim().toLowerCase()}`;

function implied(odds:number){
 if(!Number.isFinite(odds)||odds===0)return .5;
 return odds>0?100/(odds+100):Math.abs(odds)/(Math.abs(odds)+100);
}
function logLoss(p:number,y:number){
 const q=safeProb(p);return -(y*Math.log(q)+(1-y)*Math.log(1-q));
}
function blend(row:OptimizerRow,w:OptimizerWeights){
 return safeProb(row.councilProbability*w.councilWeight+row.simulationProbability*w.simulationWeight+row.marketProbability*w.marketWeight);
}
function metrics(rows:OptimizerRow[],w:OptimizerWeights){
 if(!rows.length)return {brier:0,logLoss:0,calibration:0,meanPrediction:0,actual:0};
 let brier=0,log=0,pred=0,actual=0;
 for(const row of rows){
  const p=blend(row,w);brier+=(p-row.outcome)**2;log+=logLoss(p,row.outcome);pred+=p;actual+=row.outcome;
 }
 const n=rows.length;
 return {brier:brier/n,logLoss:log/n,calibration:Math.abs(pred/n-actual/n),meanPrediction:pred/n,actual:actual/n};
}
function objective(rows:OptimizerRow[],w:OptimizerWeights){
 const m=metrics(rows,w);
 return m.brier+m.logLoss*.035+m.calibration*.06;
}
function candidateWeights(){
 const out:OptimizerWeights[]=[];
 for(let sim=40;sim<=100;sim+=5){
  for(let market=0;market<=25;market+=5){
   const simulationWeight=sim/100,marketWeight=market/100,councilWeight=1-simulationWeight-marketWeight;
   if(councilWeight<-.0001||councilWeight>.55)continue;
   out.push({councilWeight:Math.max(0,councilWeight),simulationWeight,marketWeight});
  }
 }
 return out;
}
const CANDIDATES=candidateWeights();

function normalizeWeights(w:OptimizerWeights):OptimizerWeights{
 const c=clamp(w.councilWeight),s=clamp(w.simulationWeight),m=clamp(w.marketWeight);
 const total=c+s+m||1;
 return {councilWeight:c/total,simulationWeight:s/total,marketWeight:m/total};
}
function shrink(best:OptimizerWeights,prior:OptimizerWeights,sample:number,shrinkageSamples:number){
 const strength=sample/(sample+shrinkageSamples);
 return normalizeWeights({
  councilWeight:prior.councilWeight+(best.councilWeight-prior.councilWeight)*strength,
  simulationWeight:prior.simulationWeight+(best.simulationWeight-prior.simulationWeight)*strength,
  marketWeight:prior.marketWeight+(best.marketWeight-prior.marketWeight)*strength
 });
}
function splitRows(rows:OptimizerRow[]){
 const sorted=[...rows].sort((a,b)=>new Date(a.occurredAt).getTime()-new Date(b.occurredAt).getTime());
 const holdoutCount=Math.max(1,Math.floor(sorted.length*.25));
 return {train:sorted.slice(0,Math.max(1,sorted.length-holdoutCount)),holdout:sorted.slice(Math.max(1,sorted.length-holdoutCount))};
}

function fitGroup(args:{
 rows:OptimizerRow[];sport:string;marketKey:string;scope:OptimizerProfile['scope'];
 prior:OptimizerWeights;minSample:number;shrinkageSamples:number;
}):OptimizerProfile{
 const {rows,sport,marketKey,scope,prior,minSample,shrinkageSamples}=args;
 const {train,holdout}=splitRows(rows);
 let best=prior,bestScore=objective(train,prior);
 for(const candidate of CANDIDATES){
  const score=objective(train,candidate);
  if(score<bestScore-1e-9){best=candidate;bestScore=score}
 }
 const learned=shrink(best,prior,train.length,shrinkageSamples);
 const trainMetrics=metrics(train,learned);
 const holdoutMetrics=metrics(holdout,learned);
 const baseline=metrics(holdout,prior);
 const gain=baseline.brier-holdoutMetrics.brier;
 const minHoldout=Math.max(10,Math.floor(minSample*.22));
 const enough=rows.length>=minSample&&holdout.length>=minHoldout;
 const stableLog=holdoutMetrics.logLoss<=baseline.logLoss+.006;
 const material=gain>=.0005;
 const promoted=enough&&material&&stableLog;
 const sampleConfidence=rows.length/(rows.length+shrinkageSamples);
 const gainConfidence=clamp(Math.max(0,gain)/.012,0,1);
 const confidence=clamp(sampleConfidence*(.35+.65*gainConfidence),0,1);
 const reason=!enough
  ?`Held: ${rows.length} rows / ${holdout.length} holdout below ${minSample} / ${minHoldout}`
  :!material
   ?`Held: holdout Brier gain ${gain.toFixed(4)} below 0.0005`
   :!stableLog
    ?`Held: holdout log loss ${holdoutMetrics.logLoss.toFixed(4)} exceeded prior ${baseline.logLoss.toFixed(4)} + 0.006`
    :`Promoted: holdout Brier improved by ${gain.toFixed(4)} with stable log loss`;
 return {
  sport,marketKey,scope,sampleCount:rows.length,trainCount:train.length,holdoutCount:holdout.length,
  ...learned,
  priorCouncilWeight:prior.councilWeight,priorSimulationWeight:prior.simulationWeight,priorMarketWeight:prior.marketWeight,
  trainBrier:trainMetrics.brier,holdoutBrier:holdoutMetrics.brier,baselineHoldoutBrier:baseline.brier,
  holdoutLogLoss:holdoutMetrics.logLoss,baselineHoldoutLogLoss:baseline.logLoss,holdoutBrierGain:gain,
  confidence,promoted,reason
 };
}

export function buildCrossSportOptimizerProfiles(rows:OptimizerRow[]){
 const valid=rows.filter(r=>
  Number.isFinite(r.councilProbability)&&r.councilProbability>0&&r.councilProbability<1&&
  Number.isFinite(r.simulationProbability)&&r.simulationProbability>0&&r.simulationProbability<1&&
  Number.isFinite(r.marketProbability)&&r.marketProbability>0&&r.marketProbability<1&&
  (r.outcome===0||r.outcome===1)
 );
 if(!valid.length)return [] as OptimizerProfile[];

 const profiles:OptimizerProfile[]=[];
 const global=fitGroup({rows:valid,sport:'*',marketKey:'*',scope:'GLOBAL',prior:SAFE_BASELINE,minSample:120,shrinkageSamples:180});
 profiles.push(global);
 const globalPrior=global.promoted?global:({...global,...SAFE_BASELINE} as OptimizerProfile);

 const bySport=new Map<string,OptimizerRow[]>();
 for(const row of valid){
  const sport=keyPart(row.sport);
  bySport.set(sport,[...(bySport.get(sport)||[]),row]);
 }
 const sportProfiles=new Map<string,OptimizerProfile>();
 for(const [sport,sportRows] of bySport){
  const p=fitGroup({
   rows:sportRows,sport,marketKey:'*',scope:'SPORT',
   prior:{councilWeight:globalPrior.councilWeight,simulationWeight:globalPrior.simulationWeight,marketWeight:globalPrior.marketWeight},
   minSample:75,shrinkageSamples:130
  });
  profiles.push(p);sportProfiles.set(sport,p);
 }

 const exactGroups=new Map<string,OptimizerRow[]>();
 for(const row of valid){
  const sport=keyPart(row.sport),market=String(row.marketKey||'').trim().toLowerCase();
  const k=optimizerProfileKey(sport,market);
  exactGroups.set(k,[...(exactGroups.get(k)||[]),row]);
 }
 for(const [k,group] of exactGroups){
  const [sport,marketKey]=k.split('|');
  const sportProfile=sportProfiles.get(sport);
  const parent=sportProfile?.promoted?sportProfile:globalPrior;
  profiles.push(fitGroup({
   rows:group,sport,marketKey,scope:'SPORT_MARKET',
   prior:{councilWeight:parent.councilWeight,simulationWeight:parent.simulationWeight,marketWeight:parent.marketWeight},
   minSample:40,shrinkageSamples:90
  }));
 }
 return profiles;
}

function rowFromDb(row:any):OptimizerRow|null{
 const councilProbability=Number(row.councilProbability);
 const features=row.features&&typeof row.features==='object'?row.features:{};
 const simulationProbability=Number(features.rawSimProbability??features.simProbability);
 const consensusProbability=Number(features?.consensus?.consensusProbability);
 const marketProbability=Number.isFinite(consensusProbability)&&consensusProbability>0&&consensusProbability<1
  ?consensusProbability
  :implied(Number(row.offeredOdds));
 const outcome=Number(row.outcome);
 if(!Number.isFinite(councilProbability)||!Number.isFinite(simulationProbability)||!Number.isFinite(marketProbability)||(outcome!==0&&outcome!==1))return null;
 return {
  occurredAt:new Date(row.occurredAt).toISOString(),sport:String(row.sport||''),marketKey:String(row.marketKey||''),
  councilProbability,simulationProbability,marketProbability,outcome:outcome as 0|1
 };
}

export async function rebuildCrossSportOptimizerProfiles(){
 const sql=db();
 if(!sql)return {configured:false,settledRowsRead:0,eligibleRows:0,profilesWritten:0,profilesPromoted:0};
 const run=await sql`insert into cross_sport_optimizer_runs(model_version) values(${process.env.MODEL_VERSION||'edgeforce-v61'}) returning id`;
 const runId=Number((run as any[])[0]?.id||0);
 const rows=await sql`
  select occurred_at as "occurredAt",sport,market_key as "marketKey",
   predicted_probability::float as "councilProbability",offered_odds as "offeredOdds",outcome,features
  from historical_predictions
  where outcome is not null and model_name='Model Council'
   and occurred_at>=now()-interval '730 days'
  order by occurred_at asc
  limit 50000
 `;
 const normalized=(rows as any[]).map(rowFromDb).filter((x):x is OptimizerRow=>Boolean(x));
 const profiles=buildCrossSportOptimizerProfiles(normalized);
 let promoted=0;
 for(const p of profiles){
  if(p.promoted)promoted++;
  await sql`
   insert into cross_sport_optimizer_profiles(
    sport,market_key,scope,sample_count,train_count,holdout_count,
    council_weight,simulation_weight,market_weight,
    prior_council_weight,prior_simulation_weight,prior_market_weight,
    train_brier,holdout_brier,baseline_holdout_brier,holdout_log_loss,baseline_holdout_log_loss,
    holdout_brier_gain,confidence,promoted,reason,updated_at,metadata
   ) values(
    ${p.sport},${p.marketKey},${p.scope},${p.sampleCount},${p.trainCount},${p.holdoutCount},
    ${p.councilWeight},${p.simulationWeight},${p.marketWeight},
    ${p.priorCouncilWeight},${p.priorSimulationWeight},${p.priorMarketWeight},
    ${p.trainBrier},${p.holdoutBrier},${p.baselineHoldoutBrier},${p.holdoutLogLoss},${p.baselineHoldoutLogLoss},
    ${p.holdoutBrierGain},${p.confidence},${p.promoted},${p.reason},now(),
    ${sql.json({optimizer:'v70-grid-hierarchical',candidateCount:CANDIDATES.length})}
   )
   on conflict (sport,market_key) do update set
    scope=excluded.scope,sample_count=excluded.sample_count,train_count=excluded.train_count,holdout_count=excluded.holdout_count,
    council_weight=excluded.council_weight,simulation_weight=excluded.simulation_weight,market_weight=excluded.market_weight,
    prior_council_weight=excluded.prior_council_weight,prior_simulation_weight=excluded.prior_simulation_weight,prior_market_weight=excluded.prior_market_weight,
    train_brier=excluded.train_brier,holdout_brier=excluded.holdout_brier,baseline_holdout_brier=excluded.baseline_holdout_brier,
    holdout_log_loss=excluded.holdout_log_loss,baseline_holdout_log_loss=excluded.baseline_holdout_log_loss,
    holdout_brier_gain=excluded.holdout_brier_gain,confidence=excluded.confidence,promoted=excluded.promoted,reason=excluded.reason,
    updated_at=now(),metadata=excluded.metadata
  `;
 }
 if(runId)await sql`
  update cross_sport_optimizer_runs set settled_rows_read=${(rows as any[]).length},eligible_rows=${normalized.length},
   profiles_written=${profiles.length},profiles_promoted=${promoted},completed_at=now(),
   metadata=${sql.json({lookbackDays:730,candidateCount:CANDIDATES.length})}
  where id=${runId}
 `;
 return {configured:true,settledRowsRead:(rows as any[]).length,eligibleRows:normalized.length,profilesWritten:profiles.length,profilesPromoted:promoted};
}

export async function loadCrossSportOptimizerProfiles():Promise<OptimizerProfileMap>{
 const sql=db();if(!sql)return {};
 try{
  const rows=await sql`
   select sport,market_key as "marketKey",scope,sample_count as "sampleCount",train_count as "trainCount",holdout_count as "holdoutCount",
    council_weight::float as "councilWeight",simulation_weight::float as "simulationWeight",market_weight::float as "marketWeight",
    prior_council_weight::float as "priorCouncilWeight",prior_simulation_weight::float as "priorSimulationWeight",prior_market_weight::float as "priorMarketWeight",
    train_brier::float as "trainBrier",holdout_brier::float as "holdoutBrier",baseline_holdout_brier::float as "baselineHoldoutBrier",
    holdout_log_loss::float as "holdoutLogLoss",baseline_holdout_log_loss::float as "baselineHoldoutLogLoss",
    holdout_brier_gain::float as "holdoutBrierGain",confidence::float,promoted,reason
   from cross_sport_optimizer_profiles where promoted=true
  `;
  const out:OptimizerProfileMap={};
  for(const row of rows as any[])out[optimizerProfileKey(String(row.sport),String(row.marketKey))]=row as OptimizerProfile;
  return out;
 }catch{return {}}
}

export function selectOptimizerProfile(map:OptimizerProfileMap|undefined,sport:string,marketKey:string){
 if(!map)return undefined;
 return map[optimizerProfileKey(sport,marketKey)]??map[optimizerProfileKey(sport,'*')]??map[optimizerProfileKey('*','*')];
}

export function applyOptimizerBlend(profile:OptimizerProfile|undefined,councilProbability:number,simulationProbability:number,marketProbability:number){
 if(!profile||!profile.promoted)return {
  probability:safeProb(simulationProbability),applied:false,
  weights:SAFE_BASELINE,confidence:0,scope:'NONE'
 };
 const weights=normalizeWeights(profile);
 const probability=safeProb(
  safeProb(councilProbability)*weights.councilWeight+
  safeProb(simulationProbability)*weights.simulationWeight+
  safeProb(marketProbability)*weights.marketWeight
 );
 return {probability,applied:true,weights,confidence:profile.confidence,scope:profile.scope};
}

export async function loadCrossSportOptimizerSummary(){
 const sql=db();if(!sql)return {configured:false,profiles:0,promoted:0,latestRun:null,rows:[]};
 const [counts,runs,rows]=await Promise.all([
  sql`select count(*)::int as profiles,count(*) filter(where promoted)::int as promoted from cross_sport_optimizer_profiles`,
  sql`select id,settled_rows_read as "settledRowsRead",eligible_rows as "eligibleRows",profiles_written as "profilesWritten",profiles_promoted as "profilesPromoted",started_at as "startedAt",completed_at as "completedAt" from cross_sport_optimizer_runs order by started_at desc limit 1`,
  sql`
   select sport,market_key as "marketKey",scope,sample_count as "sampleCount",holdout_count as "holdoutCount",
    council_weight::float as "councilWeight",simulation_weight::float as "simulationWeight",market_weight::float as "marketWeight",
    holdout_brier::float as "holdoutBrier",baseline_holdout_brier::float as "baselineHoldoutBrier",
    holdout_brier_gain::float as "holdoutBrierGain",confidence::float,promoted,reason,updated_at as "updatedAt"
   from cross_sport_optimizer_profiles
   order by promoted desc,holdout_brier_gain desc,sample_count desc limit 40
  `
 ]);
 const c=(counts as any[])[0]||{};
 return {configured:true,profiles:Number(c.profiles||0),promoted:Number(c.promoted||0),latestRun:(runs as any[])[0]||null,rows};
}
