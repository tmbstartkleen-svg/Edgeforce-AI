import {db} from './db';
import {summarizeBacktest,type HistoricalPrediction} from './backtest';
import {calibrationSummary} from './modelCalibration';
import {rollingModelPerformance} from './modelPerformance';
import {RELEASE} from './releaseManifest';

export type ModelDriftStatus='HEALTHY'|'WATCH'|'DRIFTING'|'CRITICAL'|'INSUFFICIENT';
export type ModelGovernanceRole='CHAMPION'|'CHALLENGER'|'MONITORED'|'HELD';

export type ModelGovernanceOptions={
 minBaseline:number;
 minRecent:number;
 recentFraction:number;
 promotionMargin:number;
 lookbackRows:number;
};

export type ModelGovernanceProfile={
 modelName:string;
 sport:string;
 marketKey:string;
 role:ModelGovernanceRole;
 driftStatus:ModelDriftStatus;
 baselineSampleSize:number;
 recentSampleSize:number;
 psi:number;
 meanProbabilityShift:number;
 brierDelta:number;
 logLossDelta:number;
 calibrationDelta:number;
 avgClvDelta:number;
 recentBrierScore:number;
 recentLogLoss:number;
 recentCalibrationError:number;
 recentDecayedScore:number;
 score:number;
 effectiveScore:number;
 weightBrake:number;
 runtimeMultiplier:number;
 reason:string;
};

export type GovernanceMultiplierMap=Record<string,number>;

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
export const modelGovernanceKey=(modelName:string,sport:string,marketKey:string)=>[modelName,sport,marketKey].join('|');
const groupKey=(sport:string,marketKey:string)=>[sport,marketKey].join('|');

export function defaultModelGovernanceOptions():ModelGovernanceOptions{
 return {
  minBaseline:Math.max(20,Number(process.env.MODEL_GOVERNANCE_MIN_BASELINE||40)),
  minRecent:Math.max(10,Number(process.env.MODEL_GOVERNANCE_MIN_RECENT||20)),
  recentFraction:clamp(Number(process.env.MODEL_GOVERNANCE_RECENT_FRACTION||.30),.15,.50),
  promotionMargin:clamp(Number(process.env.MODEL_GOVERNANCE_PROMOTION_MARGIN||.015),0,.08),
  lookbackRows:Math.max(1000,Number(process.env.MODEL_GOVERNANCE_LOOKBACK_ROWS||30000))
 };
}

function mean(values:number[]){
 return values.length?values.reduce((s,x)=>s+x,0)/values.length:0;
}

function distribution(values:number[],buckets=10){
 const counts=Array.from({length:buckets},()=>0);
 for(const raw of values){
  const p=clamp(Number(raw),0,.999999);
  counts[Math.min(buckets-1,Math.floor(p*buckets))]++;
 }
 const epsilon=.0001;
 const total=Math.max(1,values.length);
 return counts.map(n=>Math.max(epsilon,n/total));
}

export function populationStabilityIndex(baseline:number[],recent:number[],buckets=10){
 if(!baseline.length||!recent.length)return 0;
 const a=distribution(baseline,buckets);
 const b=distribution(recent,buckets);
 return a.reduce((sum,x,i)=>sum+(b[i]-x)*Math.log(b[i]/x),0);
}

function driftStatus(psi:number,brierDelta:number,logLossDelta:number,calibrationDelta:number):ModelDriftStatus{
 if(psi>=.30||brierDelta>=.08||logLossDelta>=.18||calibrationDelta>=.08)return 'CRITICAL';
 if(psi>=.18||brierDelta>=.045||logLossDelta>=.10||calibrationDelta>=.045)return 'DRIFTING';
 if(psi>=.10||brierDelta>=.02||logLossDelta>=.05||calibrationDelta>=.025)return 'WATCH';
 return 'HEALTHY';
}

function statusBrake(status:ModelDriftStatus){
 if(status==='WATCH')return .92;
 if(status==='DRIFTING')return .72;
 if(status==='CRITICAL')return .45;
 return 1;
}

function scoreRecent(rows:HistoricalPrediction[]){
 const summary=summarizeBacktest(rows);
 const cal=calibrationSummary(rows);
 const perf=rollingModelPerformance(rows)[0];
 const brierQuality=clamp(1-summary.brierScore/.35);
 const logQuality=clamp(1-summary.logLoss/.90);
 const calibrationQuality=clamp(1-cal.meanAbsoluteCalibrationError/.15);
 const decayed=clamp(perf?.decayedScore??0);
 const clvQuality=clamp(.5+summary.avgClv*5);
 return {
  score:brierQuality*.32+logQuality*.18+calibrationQuality*.18+decayed*.22+clvQuality*.10,
  summary,
  calibration:cal,
  decayedScore:decayed
 };
}

function splitGroup(rows:HistoricalPrediction[],options:ModelGovernanceOptions){
 const sorted=[...rows].sort((a,b)=>new Date(a.occurredAt).getTime()-new Date(b.occurredAt).getTime());
 if(sorted.length<options.minBaseline+options.minRecent)return {baseline:sorted,recent:[]};
 const desired=Math.max(options.minRecent,Math.floor(sorted.length*options.recentFraction));
 const recentSize=Math.min(sorted.length-options.minBaseline,desired);
 return {baseline:sorted.slice(0,sorted.length-recentSize),recent:sorted.slice(sorted.length-recentSize)};
}

function baseProfiles(rows:HistoricalPrediction[],options:ModelGovernanceOptions){
 const groups=new Map<string,HistoricalPrediction[]>();
 for(const row of rows){
  const k=modelGovernanceKey(row.modelName,row.sport,row.marketKey);
  groups.set(k,[...(groups.get(k)||[]),row]);
 }

 const profiles:ModelGovernanceProfile[]=[];
 for(const [key,group] of groups){
  const [modelName,sport,marketKey]=key.split('|');
  const {baseline,recent}=splitGroup(group,options);
  if(recent.length<options.minRecent||baseline.length<options.minBaseline){
   profiles.push({
    modelName,sport,marketKey,role:'MONITORED',driftStatus:'INSUFFICIENT',
    baselineSampleSize:baseline.length,recentSampleSize:recent.length,psi:0,meanProbabilityShift:0,
    brierDelta:0,logLossDelta:0,calibrationDelta:0,avgClvDelta:0,
    recentBrierScore:0,recentLogLoss:0,recentCalibrationError:0,recentDecayedScore:0,
    score:0,effectiveScore:0,weightBrake:1,runtimeMultiplier:1,
    reason:`Insufficient history: baseline ${baseline.length}/${options.minBaseline}, recent ${recent.length}/${options.minRecent}`
   });
   continue;
  }

  const baselineSummary=summarizeBacktest(baseline);
  const baselineCalibration=calibrationSummary(baseline);
  const recentEval=scoreRecent(recent);
  const psi=populationStabilityIndex(baseline.map(x=>x.predicted),recent.map(x=>x.predicted));
  const brierDelta=recentEval.summary.brierScore-baselineSummary.brierScore;
  const logLossDelta=recentEval.summary.logLoss-baselineSummary.logLoss;
  const calibrationDelta=recentEval.calibration.meanAbsoluteCalibrationError-baselineCalibration.meanAbsoluteCalibrationError;
  const avgClvDelta=recentEval.summary.avgClv-baselineSummary.avgClv;
  const meanProbabilityShift=mean(recent.map(x=>x.predicted))-mean(baseline.map(x=>x.predicted));
  const status=driftStatus(psi,brierDelta,logLossDelta,calibrationDelta);
  const weightBrake=statusBrake(status);
  const effectiveScore=recentEval.score*weightBrake;

  profiles.push({
   modelName,sport,marketKey,role:'MONITORED',driftStatus:status,
   baselineSampleSize:baseline.length,recentSampleSize:recent.length,
   psi,meanProbabilityShift,brierDelta,logLossDelta,calibrationDelta,avgClvDelta,
   recentBrierScore:recentEval.summary.brierScore,
   recentLogLoss:recentEval.summary.logLoss,
   recentCalibrationError:recentEval.calibration.meanAbsoluteCalibrationError,
   recentDecayedScore:recentEval.decayedScore,
   score:recentEval.score,effectiveScore,weightBrake,runtimeMultiplier:weightBrake,
   reason:`${status}: PSI ${psi.toFixed(3)}, Brier Δ ${brierDelta.toFixed(3)}, log-loss Δ ${logLossDelta.toFixed(3)}, calibration Δ ${calibrationDelta.toFixed(3)}`
  });
 }
 return profiles;
}

export function evaluateModelGovernance(
 rows:HistoricalPrediction[],
 options=defaultModelGovernanceOptions(),
 previousChampions:Record<string,string>={}
):ModelGovernanceProfile[]{
 const profiles=baseProfiles(rows,options);
 const byGroup=new Map<string,ModelGovernanceProfile[]>();
 for(const p of profiles)byGroup.set(groupKey(p.sport,p.marketKey),[...(byGroup.get(groupKey(p.sport,p.marketKey))||[]),p]);

 for(const [g,list] of byGroup){
  const eligible=list.filter(x=>x.driftStatus!=='CRITICAL'&&x.driftStatus!=='INSUFFICIENT')
   .sort((a,b)=>b.effectiveScore-a.effectiveScore||b.recentSampleSize-a.recentSampleSize);
  let champion=eligible[0];
  const previousName=previousChampions[g];
  const previous=previousName?eligible.find(x=>x.modelName===previousName):undefined;
  if(previous&&champion&&champion.modelName!==previous.modelName&&champion.effectiveScore<previous.effectiveScore+options.promotionMargin){
   champion=previous;
  }
  const challenger=eligible.find(x=>x.modelName!==champion?.modelName);

  for(const p of list){
   if(p.driftStatus==='CRITICAL')p.role='HELD';
   else if(p.modelName===champion?.modelName)p.role='CHAMPION';
   else if(p.modelName===challenger?.modelName)p.role='CHALLENGER';
   else p.role='MONITORED';

   const roleScale=p.role==='CHAMPION'?1.04:p.role==='CHALLENGER'?1:p.role==='MONITORED'?0.96:0.75;
   p.runtimeMultiplier=p.driftStatus==='INSUFFICIENT'?1:clamp(p.weightBrake*roleScale,.35,1.05);
   p.reason+=`; role ${p.role}, runtime ×${p.runtimeMultiplier.toFixed(3)}`;
  }
 }
 return profiles.sort((a,b)=>{
  const g=groupKey(a.sport,a.marketKey).localeCompare(groupKey(b.sport,b.marketKey));
  if(g)return g;
  const rank=(r:ModelGovernanceRole)=>r==='CHAMPION'?0:r==='CHALLENGER'?1:r==='MONITORED'?2:3;
  return rank(a.role)-rank(b.role)||b.effectiveScore-a.effectiveScore;
 });
}

async function previousChampionMap(){
 const sql=db();
 if(!sql)return {};
 try{
  const rows=await sql`
   select distinct on (sport,market_key)
    sport,market_key as "marketKey",model_name as "modelName"
   from model_governance_snapshots
   where role='CHAMPION'
   order by sport,market_key,as_of desc
  `;
  return Object.fromEntries((rows as any[]).map(x=>[groupKey(String(x.sport),String(x.marketKey)),String(x.modelName)]));
 }catch{
  return {};
 }
}

export async function runModelGovernance(options=defaultModelGovernanceOptions()){
 const sql=db();
 if(!sql)return {ok:true,mode:'dry-run' as const,rows:0,profiles:[],summary:{champions:0,challengers:0,watch:0,drifting:0,critical:0},options};

 const [run]=await sql`
  insert into model_governance_runs(model_version,status,started_at)
  values(${RELEASE.modelVersion},'running',now())
  returning id
 `;
 try{
  const rows=await sql`
   select occurred_at as "occurredAt",sport,market_key as "marketKey",model_name as "modelName",
    predicted_probability::float as predicted,offered_odds as odds,closing_odds as "closingOdds",outcome
   from historical_predictions
   where outcome is not null
   order by occurred_at desc
   limit ${options.lookbackRows}
  `;
  const history=rows as unknown as HistoricalPrediction[];
  const previous=await previousChampionMap();
  const profiles=evaluateModelGovernance(history,options,previous);

  for(const p of profiles){
   await sql`
    insert into model_governance_snapshots(
     model_name,sport,market_key,role,drift_status,
     baseline_sample_size,recent_sample_size,psi,mean_probability_shift,
     brier_delta,log_loss_delta,calibration_delta,avg_clv_delta,
     recent_brier_score,recent_log_loss,recent_calibration_error,recent_decayed_score,
     score,effective_score,weight_brake,runtime_multiplier,reason,model_version,as_of
    ) values(
     ${p.modelName},${p.sport},${p.marketKey},${p.role},${p.driftStatus},
     ${p.baselineSampleSize},${p.recentSampleSize},${p.psi},${p.meanProbabilityShift},
     ${p.brierDelta},${p.logLossDelta},${p.calibrationDelta},${p.avgClvDelta},
     ${p.recentBrierScore},${p.recentLogLoss},${p.recentCalibrationError},${p.recentDecayedScore},
     ${p.score},${p.effectiveScore},${p.weightBrake},${p.runtimeMultiplier},${p.reason},${RELEASE.modelVersion},now()
    )
   `;
  }

  const summary={
   champions:profiles.filter(x=>x.role==='CHAMPION').length,
   challengers:profiles.filter(x=>x.role==='CHALLENGER').length,
   watch:profiles.filter(x=>x.driftStatus==='WATCH').length,
   drifting:profiles.filter(x=>x.driftStatus==='DRIFTING').length,
   critical:profiles.filter(x=>x.driftStatus==='CRITICAL').length
  };
  await sql`
   update model_governance_runs set
    completed_at=now(),status='completed',prediction_rows=${history.length},
    groups_evaluated=${profiles.length},champions=${summary.champions},
    challengers=${summary.challengers},watch_count=${summary.watch},
    drifting_count=${summary.drifting},critical_count=${summary.critical},
    metrics=${sql.json({options,top:profiles.slice(0,50)})}
   where id=${run.id}
  `;
  return {ok:true,mode:'database' as const,runId:Number(run.id),rows:history.length,profiles,summary,options};
 }catch(error){
  await sql`
   update model_governance_runs set completed_at=now(),status='failed',
    error_text=${error instanceof Error?error.message:'model governance failed'}
   where id=${run.id}
  `.catch(()=>undefined);
  throw error;
 }
}

export async function loadGovernanceMultipliers():Promise<GovernanceMultiplierMap>{
 const sql=db();
 if(!sql)return {};
 try{
  const rows=await sql`
   select distinct on (model_name,sport,market_key)
    model_name as "modelName",sport,market_key as "marketKey",runtime_multiplier::float as "runtimeMultiplier"
   from model_governance_snapshots
   order by model_name,sport,market_key,as_of desc
  `;
  return Object.fromEntries((rows as any[]).map(x=>[
   modelGovernanceKey(String(x.modelName),String(x.sport),String(x.marketKey)),
   clamp(Number(x.runtimeMultiplier)||1,.35,1.05)
  ]));
 }catch{
  return {};
 }
}

export async function getModelGovernanceStatus(){
 const sql=db();
 if(!sql)return {ok:true,source:'none' as const,latestRun:null,profiles:[],summary:{champions:0,challengers:0,watch:0,drifting:0,critical:0,averagePsi:0}};
 try{
  const [latestRun]=await sql`
   select id,model_version as "modelVersion",status,prediction_rows as "predictionRows",
    groups_evaluated as "groupsEvaluated",champions,challengers,
    watch_count as "watchCount",drifting_count as "driftingCount",critical_count as "criticalCount",
    started_at as "startedAt",completed_at as "completedAt",error_text as error
   from model_governance_runs order by started_at desc limit 1
  `;
  const profiles=await sql`
   select distinct on (model_name,sport,market_key)
    model_name as "modelName",sport,market_key as "marketKey",role,drift_status as "driftStatus",
    baseline_sample_size as "baselineSampleSize",recent_sample_size as "recentSampleSize",
    psi::float,mean_probability_shift::float as "meanProbabilityShift",
    brier_delta::float as "brierDelta",log_loss_delta::float as "logLossDelta",
    calibration_delta::float as "calibrationDelta",recent_brier_score::float as "recentBrierScore",
    recent_log_loss::float as "recentLogLoss",recent_calibration_error::float as "recentCalibrationError",
    score::float,effective_score::float as "effectiveScore",weight_brake::float as "weightBrake",
    runtime_multiplier::float as "runtimeMultiplier",reason,as_of as "asOf"
   from model_governance_snapshots
   order by model_name,sport,market_key,as_of desc
   limit 1000
  `;
  const rows=profiles as any[];
  const summary={
   champions:rows.filter(x=>x.role==='CHAMPION').length,
   challengers:rows.filter(x=>x.role==='CHALLENGER').length,
   watch:rows.filter(x=>x.driftStatus==='WATCH').length,
   drifting:rows.filter(x=>x.driftStatus==='DRIFTING').length,
   critical:rows.filter(x=>x.driftStatus==='CRITICAL').length,
   averagePsi:rows.length?rows.reduce((s,x)=>s+Number(x.psi||0),0)/rows.length:0
  };
  return {ok:true,source:'database' as const,latestRun:latestRun||null,profiles:rows,summary};
 }catch(error){
  return {ok:false,source:'database' as const,latestRun:null,profiles:[],summary:{champions:0,challengers:0,watch:0,drifting:0,critical:0,averagePsi:0},error:error instanceof Error?error.message:'model governance query failed'};
 }
}
