import {db} from './db';
import {summarizeBacktest,walkForward,type HistoricalPrediction,type BacktestSummary} from './backtest';
import {calibrationBuckets,calibrationSummary,type CalibrationBucket} from './modelCalibration';
import {RELEASE} from './releaseManifest';
import {settlementLearningFromFeatures} from './settlementLearning';

export type EvidenceGrade='VERIFIED'|'QUALIFIED'|'PROVISIONAL'|'INSUFFICIENT'|'FAILED';

export type ConfidenceBand={
 label:string;
 min:number;
 max:number;
 sampleSize:number;
 predicted:number;
 actual:number;
 error:number;
 brierScore:number;
};

export type PairedComparison={
 sampleSize:number;
 baselineBrier:number;
 alternativeBrier:number;
 brierDelta:number;
 standardError:number;
 ci95:[number,number];
 better:'BASELINE'|'ALTERNATIVE'|'TIE'|'INSUFFICIENT';
};

export type ContextContribution={
 richSampleSize:number;
 thinSampleSize:number;
 richBrier:number;
 thinBrier:number;
 richLogLoss:number;
 thinLogLoss:number;
 brierDelta:number;
 logLossDelta:number;
 note:string;
};

export type ValidationMetrics={
 summary:BacktestSummary;
 calibrationError:number;
 calibrationBuckets:CalibrationBucket[];
 confidenceBands:ConfidenceBand[];
 marketBaselineBrier:number;
 marketBaselineLogLoss:number;
 brierSkillScore:number;
 logLossImprovement:number;
 holdout:BacktestSummary;
 holdoutCalibrationError:number;
 walkForwardFolds:number;
 walkForwardBrier:number;
 walkForwardLogLoss:number;
 simulationComparison:PairedComparison;
 contextContribution:ContextContribution;
};

export type ValidationGroup={
 modelName:string;
 sport:string;
 marketKey:string;
 sampleSize:number;
 effectiveSampleSize:number;
 holdoutSampleSize:number;
 holdoutEffectiveSampleSize:number;
 evidenceGrade:EvidenceGrade;
 promotionEligible:boolean;
 reason:string;
 metrics:ValidationMetrics;
};

export type ValidationReport={
 generatedAt:string;
 sampleSize:number;
 overall:ValidationMetrics;
 groups:ValidationGroup[];
 bySport:Array<{sport:string;sampleSize:number;metrics:ValidationMetrics}>;
 byMarket:Array<{marketKey:string;sampleSize:number;metrics:ValidationMetrics}>;
 evidence:{verified:number;qualified:number;provisional:number;insufficient:number;failed:number;promotionEligible:number};
 diagnostics:{
  contextTaggedRows:number;
  simulationTaggedRows:number;
  closingLineRows:number;
  modelVersions:string[];
 };
};

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const decimal=(odds:number)=>odds>0?1+odds/100:1+100/Math.max(1,Math.abs(odds));
const implied=(odds:number)=>clamp(1/decimal(odds),.001,.999);
const safeProb=(v:unknown)=>{
 const n=Number(v);
 return Number.isFinite(n)&&n>0&&n<1?n:undefined;
};
const mean=(values:number[])=>values.length?values.reduce((s,x)=>s+x,0)/values.length:0;
const featureObj=(row:HistoricalPrediction)=>row.features&&typeof row.features==='object'?row.features:{};
const contextQuality=(row:HistoricalPrediction)=>{
 const q=(featureObj(row) as any).contextQuality;
 return q&&typeof q==='object'?q as Record<string,unknown>|null:null;
};
const simulationProbability=(row:HistoricalPrediction)=>{
 const f=featureObj(row) as any;
 return safeProb(f.simProbability??f.rawSimProbability??f.sportModelProbability);
};

function logLossFor(probability:number,outcome:0|1){
 const p=clamp(probability,.001,.999);
 return -(outcome*Math.log(p)+(1-outcome)*Math.log(1-p));
}

function marketBaseline(rows:HistoricalPrediction[]){
 if(!rows.length)return {brierScore:0,logLoss:0};
 let brier=0,log=0;
 for(const row of rows){
  const p=implied(row.odds);
  brier+=(p-row.outcome)**2;
  log+=logLossFor(p,row.outcome);
 }
 return {brierScore:brier/rows.length,logLoss:log/rows.length};
}

function confidenceBands(rows:HistoricalPrediction[]):ConfidenceBand[]{
 const bands=[
  {label:'0-49%',min:0,max:.50},
  {label:'50-54%',min:.50,max:.55},
  {label:'55-59%',min:.55,max:.60},
  {label:'60-64%',min:.60,max:.65},
  {label:'65-69%',min:.65,max:.70},
  {label:'70-74%',min:.70,max:.75},
  {label:'75-79%',min:.75,max:.80},
  {label:'80-84%',min:.80,max:.85},
  {label:'85%+',min:.85,max:1.001}
 ];
 return bands.map(b=>{
  const group=rows.filter(x=>x.predicted>=b.min&&x.predicted<b.max);
  const predicted=group.length?mean(group.map(x=>x.predicted)):0;
  const actual=group.length?mean(group.map(x=>x.outcome)):0;
  const brierScore=group.length?mean(group.map(x=>(x.predicted-x.outcome)**2)):0;
  return {...b,sampleSize:group.length,predicted,actual,error:predicted-actual,brierScore};
 });
}

export function pairedProbabilityComparison(
 rows:HistoricalPrediction[],
 alternative:(row:HistoricalPrediction)=>number|undefined
):PairedComparison{
 const pairs=rows.map(row=>{
  const alt=alternative(row);
  if(alt===undefined)return null;
  const baseline=(row.predicted-row.outcome)**2;
  const alternativeError=(alt-row.outcome)**2;
  return {baseline,alternative:alternativeError,delta:alternativeError-baseline};
 }).filter((x):x is {baseline:number;alternative:number;delta:number}=>Boolean(x));

 if(pairs.length<2){
  return {sampleSize:pairs.length,baselineBrier:pairs[0]?.baseline??0,alternativeBrier:pairs[0]?.alternative??0,brierDelta:pairs[0]?.delta??0,standardError:0,ci95:[0,0],better:'INSUFFICIENT'};
 }
 const deltas=pairs.map(x=>x.delta);
 const delta=mean(deltas);
 const variance=deltas.reduce((s,x)=>s+(x-delta)**2,0)/(deltas.length-1);
 const standardError=Math.sqrt(variance/deltas.length);
 const margin=1.96*standardError;
 const ci95:[number,number]=[delta-margin,delta+margin];
 const better:PairedComparison['better']=ci95[1]<0?'ALTERNATIVE':ci95[0]>0?'BASELINE':'TIE';
 return {
  sampleSize:pairs.length,
  baselineBrier:mean(pairs.map(x=>x.baseline)),
  alternativeBrier:mean(pairs.map(x=>x.alternative)),
  brierDelta:delta,standardError,ci95,better
 };
}

function contextContribution(rows:HistoricalPrediction[]):ContextContribution{
 const rich=rows.filter(row=>{
  const q=contextQuality(row);
  return Boolean(q)&&(Number(q?.coverage)||0)>=.55&&(q?.recommendationReady===true||(Number(q?.criticalCoverage)||0)>=.66);
 });
 const thin=rows.filter(row=>{
  const q=contextQuality(row);
  return !q||(Number(q?.coverage)||0)<.55;
 });
 const richSummary=summarizeBacktest(rich);
 const thinSummary=summarizeBacktest(thin);
 return {
  richSampleSize:rich.length,thinSampleSize:thin.length,
  richBrier:richSummary.brierScore,thinBrier:thinSummary.brierScore,
  richLogLoss:richSummary.logLoss,thinLogLoss:thinSummary.logLoss,
  brierDelta:rich.length&&thin.length?richSummary.brierScore-thinSummary.brierScore:0,
  logLossDelta:rich.length&&thin.length?richSummary.logLoss-thinSummary.logLoss:0,
  note:'Observational comparison only; context-rich and context-thin rows may differ by sport, market, timing, and difficulty.'
 };
}

function holdoutRows(rows:HistoricalPrediction[]){
 const sorted=[...rows].sort((a,b)=>new Date(a.occurredAt).getTime()-new Date(b.occurredAt).getTime());
 const size=Math.max(1,Math.floor(sorted.length*.25));
 return sorted.slice(Math.max(0,sorted.length-size));
}

export function validationMetrics(rows:HistoricalPrediction[]):ValidationMetrics{
 const summary=summarizeBacktest(rows);
 const cal=calibrationSummary(rows);
 const baseline=marketBaseline(rows);
 const holdout=holdoutRows(rows);
 const holdoutSummary=summarizeBacktest(holdout);
 const holdoutCal=calibrationSummary(holdout);
 const train=Math.min(200,Math.max(25,Math.floor(rows.length*.60)));
 const test=Math.min(50,Math.max(10,Math.floor(rows.length*.20)));
 const folds=walkForward(rows,train,test);
 const walkForwardBrier=folds.length?mean(folds.map(x=>x.test.brierScore)):holdoutSummary.brierScore;
 const walkForwardLogLoss=folds.length?mean(folds.map(x=>x.test.logLoss)):holdoutSummary.logLoss;
 const brierSkillScore=baseline.brierScore>0?1-summary.brierScore/baseline.brierScore:0;
 const logLossImprovement=baseline.logLoss>0?(baseline.logLoss-summary.logLoss)/baseline.logLoss:0;

 return {
  summary,
  calibrationError:cal.meanAbsoluteCalibrationError,
  calibrationBuckets:calibrationBuckets(rows),
  confidenceBands:confidenceBands(rows),
  marketBaselineBrier:baseline.brierScore,
  marketBaselineLogLoss:baseline.logLoss,
  brierSkillScore,
  logLossImprovement,
  holdout:holdoutSummary,
  holdoutCalibrationError:holdoutCal.meanAbsoluteCalibrationError,
  walkForwardFolds:folds.length,
  walkForwardBrier,
  walkForwardLogLoss,
  simulationComparison:pairedProbabilityComparison(rows,simulationProbability),
  contextContribution:contextContribution(rows)
 };
}

function gradeEvidence(rows:HistoricalPrediction[],metrics:ValidationMetrics){
 const sample=rows.length;
 const effectiveSample=metrics.summary.effectiveSampleSize;
 const holdout=metrics.holdout.sampleSize;
 const effectiveHoldout=metrics.holdout.effectiveSampleSize;
 if(effectiveSample<25||effectiveHoldout<8){
  return {evidenceGrade:'INSUFFICIENT' as const,promotionEligible:false,reason:`Insufficient effective settled history: ${effectiveSample.toFixed(2)} effective / ${sample} raw samples, ${effectiveHoldout.toFixed(2)} effective / ${holdout} raw holdout`};
 }
 const failed=
  metrics.holdout.brierScore>.32||
  metrics.holdout.logLoss>.85||
  metrics.holdoutCalibrationError>.14||
  metrics.brierSkillScore<-.08;
 if(failed){
  return {evidenceGrade:'FAILED' as const,promotionEligible:false,reason:`Holdout quality failed: Brier ${metrics.holdout.brierScore.toFixed(3)}, log loss ${metrics.holdout.logLoss.toFixed(3)}, calibration ${metrics.holdoutCalibrationError.toFixed(3)}, skill ${metrics.brierSkillScore.toFixed(3)}`};
 }
 if(effectiveSample<75||effectiveHoldout<20||metrics.walkForwardFolds<1){
  return {evidenceGrade:'PROVISIONAL' as const,promotionEligible:false,reason:`Promising but not enough effective out-of-sample depth: ${effectiveSample.toFixed(2)} effective / ${sample} raw samples, ${effectiveHoldout.toFixed(2)} effective / ${holdout} raw holdout, ${metrics.walkForwardFolds} folds`};
 }
 const eligible=
  metrics.holdout.brierScore<=.28&&
  metrics.holdout.logLoss<=.78&&
  metrics.holdoutCalibrationError<=.10&&
  metrics.brierSkillScore>=0&&
  metrics.summary.avgClv>=-.02;
 if(!eligible){
  return {evidenceGrade:'PROVISIONAL' as const,promotionEligible:false,reason:`Evidence not yet strong enough for promotion: holdout Brier ${metrics.holdout.brierScore.toFixed(3)}, calibration ${metrics.holdoutCalibrationError.toFixed(3)}, skill ${metrics.brierSkillScore.toFixed(3)}, CLV ${metrics.summary.avgClv.toFixed(3)}`};
 }
 if(effectiveSample>=200&&effectiveHoldout>=50&&metrics.walkForwardFolds>=3&&metrics.holdout.brierScore<=.25&&metrics.holdoutCalibrationError<=.075&&metrics.brierSkillScore>=.03){
  return {evidenceGrade:'VERIFIED' as const,promotionEligible:true,reason:'Verified with deep settled history, multiple walk-forward folds, positive market-relative skill, and calibrated holdout performance'};
 }
 return {evidenceGrade:'QUALIFIED' as const,promotionEligible:true,reason:'Qualified by minimum out-of-sample, calibration, CLV, and market-relative skill gates'};
}

function groups(rows:HistoricalPrediction[]){
 const map=new Map<string,HistoricalPrediction[]>();
 for(const row of rows){
  const key=[row.modelName,row.sport,row.marketKey].join('|');
  map.set(key,[...(map.get(key)||[]),row]);
 }
 return [...map.entries()].map(([key,group])=>{
  const [modelName,sport,marketKey]=key.split('|');
  const metrics=validationMetrics(group);
  const evidence=gradeEvidence(group,metrics);
  return {modelName,sport,marketKey,sampleSize:group.length,effectiveSampleSize:metrics.summary.effectiveSampleSize,holdoutSampleSize:metrics.holdout.sampleSize,holdoutEffectiveSampleSize:metrics.holdout.effectiveSampleSize,...evidence,metrics} satisfies ValidationGroup;
 }).sort((a,b)=>{
  const rank=(x:EvidenceGrade)=>x==='VERIFIED'?0:x==='QUALIFIED'?1:x==='PROVISIONAL'?2:x==='INSUFFICIENT'?3:4;
  return rank(a.evidenceGrade)-rank(b.evidenceGrade)||b.sampleSize-a.sampleSize;
 });
}

function slices(rows:HistoricalPrediction[],key:'sport'|'marketKey'){
 const map=new Map<string,HistoricalPrediction[]>();
 for(const row of rows){
  const value=String(row[key]);
  map.set(value,[...(map.get(value)||[]),row]);
 }
 return [...map.entries()].map(([value,group])=>({
  [key]:value,
  sampleSize:group.length,
  metrics:validationMetrics(group)
 })) as Array<any>;
}

export function buildValidationReport(rows:HistoricalPrediction[]):ValidationReport{
 const evaluated=groups(rows);
 const evidence={
  verified:evaluated.filter(x=>x.evidenceGrade==='VERIFIED').length,
  qualified:evaluated.filter(x=>x.evidenceGrade==='QUALIFIED').length,
  provisional:evaluated.filter(x=>x.evidenceGrade==='PROVISIONAL').length,
  insufficient:evaluated.filter(x=>x.evidenceGrade==='INSUFFICIENT').length,
  failed:evaluated.filter(x=>x.evidenceGrade==='FAILED').length,
  promotionEligible:evaluated.filter(x=>x.promotionEligible).length
 };
 return {
  generatedAt:new Date().toISOString(),
  sampleSize:rows.length,
  overall:validationMetrics(rows),
  groups:evaluated,
  bySport:slices(rows,'sport') as ValidationReport['bySport'],
  byMarket:slices(rows,'marketKey') as ValidationReport['byMarket'],
  evidence,
  diagnostics:{
   contextTaggedRows:rows.filter(x=>Boolean(contextQuality(x))).length,
   simulationTaggedRows:rows.filter(x=>simulationProbability(x)!==undefined).length,
   closingLineRows:rows.filter(x=>Number.isFinite(Number(x.closingOdds))).length,
   modelVersions:[...new Set(rows.map(x=>String(x.modelVersion||'unknown')))].sort()
  }
 };
}

export async function loadValidationRows(limit=Math.max(1000,Number(process.env.VALIDATION_LOOKBACK_ROWS)||30000)){
 const sql=db();
 if(!sql)return [] as HistoricalPrediction[];
 const rows=await sql`
  select occurred_at as "occurredAt",sport,market_key as "marketKey",selection_key as "selectionKey",
   model_name as "modelName",model_version as "modelVersion",
   predicted_probability::float as predicted,offered_odds as odds,closing_odds as "closingOdds",
   outcome,features
  from historical_predictions
  where outcome is not null
  order by occurred_at desc
  limit ${limit}
 `;
 return (rows as unknown as HistoricalPrediction[]).filter(row=>settlementLearningFromFeatures(row.features).trainingEligible);
}

export async function runValidationLab(){
 const sql=db();
 if(!sql){
  const report=buildValidationReport([]);
  return {ok:true,mode:'dry-run' as const,report};
 }
 const [run]=await sql`
  insert into validation_runs(model_version,status,started_at)
  values(${RELEASE.modelVersion},'running',now())
  returning id
 `;
 try{
  const rows=await loadValidationRows();
  const report=buildValidationReport(rows);
  for(const group of report.groups){
   await sql`
    insert into validation_snapshots(
     validation_run_id,model_name,sport,market_key,sample_size,holdout_sample_size,
     brier_score,log_loss,calibration_error,brier_skill_score,avg_clv,roi,
     walk_forward_folds,walk_forward_brier,context_brier_delta,simulation_brier_delta,
     evidence_grade,promotion_eligible,reason,metrics,model_version,as_of
    ) values(
     ${run.id},${group.modelName},${group.sport},${group.marketKey},${group.sampleSize},${group.holdoutSampleSize},
     ${group.metrics.summary.brierScore},${group.metrics.summary.logLoss},${group.metrics.calibrationError},
     ${group.metrics.brierSkillScore},${group.metrics.summary.avgClv},${group.metrics.summary.roi},
     ${group.metrics.walkForwardFolds},${group.metrics.walkForwardBrier},
     ${group.metrics.contextContribution.brierDelta},${group.metrics.simulationComparison.brierDelta},
     ${group.evidenceGrade},${group.promotionEligible},${group.reason},
     ${sql.json(group.metrics as any)},${RELEASE.modelVersion},now()
    )
   `;
  }
  await sql`
   update validation_runs set
    completed_at=now(),status='completed',prediction_rows=${report.sampleSize},
    groups_evaluated=${report.groups.length},evidence_passed=${report.evidence.promotionEligible},
    evidence_held=${report.groups.length-report.evidence.promotionEligible},
    overall=${sql.json(report.overall as any)},diagnostics=${sql.json(report.diagnostics as any)}
   where id=${run.id}
  `;
  return {ok:true,mode:'database' as const,runId:Number(run.id),report};
 }catch(error){
  await sql`
   update validation_runs set completed_at=now(),status='failed',
    error_text=${error instanceof Error?error.message:'validation lab failed'}
   where id=${run.id}
  `.catch(()=>undefined);
  throw error;
 }
}

export async function getValidationLabStatus(){
 const sql=db();
 if(!sql)return {ok:true,source:'none' as const,latestRun:null,snapshots:[],report:buildValidationReport([])};
 try{
  const rows=await loadValidationRows();
  const report=buildValidationReport(rows);
  const [latestRun]=await sql`
   select id,model_version as "modelVersion",status,prediction_rows as "predictionRows",
    groups_evaluated as "groupsEvaluated",evidence_passed as "evidencePassed",
    evidence_held as "evidenceHeld",overall,diagnostics,started_at as "startedAt",
    completed_at as "completedAt",error_text as error
   from validation_runs order by started_at desc limit 1
  `;
  const snapshots=await sql`
   select distinct on (model_name,sport,market_key)
    model_name as "modelName",sport,market_key as "marketKey",sample_size as "sampleSize",
    holdout_sample_size as "holdoutSampleSize",brier_score::float as "brierScore",
    log_loss::float as "logLoss",calibration_error::float as "calibrationError",
    brier_skill_score::float as "brierSkillScore",avg_clv::float as "avgClv",roi::float,
    walk_forward_folds as "walkForwardFolds",walk_forward_brier::float as "walkForwardBrier",
    context_brier_delta::float as "contextBrierDelta",simulation_brier_delta::float as "simulationBrierDelta",
    evidence_grade as "evidenceGrade",promotion_eligible as "promotionEligible",reason,as_of as "asOf"
   from validation_snapshots
   order by model_name,sport,market_key,as_of desc
   limit 1000
  `;
  return {ok:true,source:'database' as const,latestRun:latestRun||null,snapshots,report};
 }catch(error){
  return {ok:false,source:'database' as const,latestRun:null,snapshots:[],report:buildValidationReport([]),error:error instanceof Error?error.message:'validation lab query failed'};
 }
}

export async function loadValidationMultipliers(){
 const sql=db();
 if(!sql)return {} as Record<string,number>;
 try{
  const rows=await sql`
   select distinct on (model_name,sport,market_key)
    model_name as "modelName",sport,market_key as "marketKey",
    evidence_grade as "evidenceGrade",promotion_eligible as "promotionEligible",
    brier_skill_score::float as "brierSkillScore"
   from validation_snapshots
   order by model_name,sport,market_key,as_of desc
  `;
  return Object.fromEntries((rows as any[]).map(row=>{
   const key=[row.modelName,row.sport,row.marketKey].join('|');
   const grade=String(row.evidenceGrade);
   const eligible=Boolean(row.promotionEligible);
   const skill=Number(row.brierSkillScore)||0;
   const scale=eligible
    ?clamp(1+Math.min(.04,Math.max(0,skill)*.20),.95,1.04)
    :grade==='FAILED' ? .55 : grade==='PROVISIONAL' ? .88 : grade==='INSUFFICIENT' ? .96 : .92;
   return [key,scale];
  }));
 }catch{
  return {};
 }
}
