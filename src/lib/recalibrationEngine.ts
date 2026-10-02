import {db} from './db';
import {summarizeBacktest,walkForward,type HistoricalPrediction} from './backtest';
import {calibrationSummary} from './modelCalibration';
import {rollingModelPerformance} from './modelPerformance';

export type RecalibrationOptions={
 minSample:number;
 minHoldout:number;
 shrinkageSamples:number;
 maxAdjustment:number;
 lookbackRows:number;
 trainSize:number;
 testSize:number;
};

export type RecalibrationGroup={
 modelName:string;
 sport:string;
 marketKey:string;
 sampleSize:number;
 holdoutSampleSize:number;
 multiplier:number;
 promoted:boolean;
 reason:string;
 calibrationError:number;
 decayedScore:number;
 avgClv:number;
 brierScore:number;
 logLoss:number;
 roi:number;
 walkForwardFolds:number;
 holdoutBrierScore:number;
 holdoutLogLoss:number;
};

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

export function defaultRecalibrationOptions():RecalibrationOptions{
 return {
  minSample:Math.max(25,Number(process.env.CALIBRATION_MIN_SAMPLE||50)),
  minHoldout:Math.max(10,Number(process.env.CALIBRATION_MIN_HOLDOUT||20)),
  shrinkageSamples:Math.max(25,Number(process.env.CALIBRATION_SHRINKAGE_SAMPLES||100)),
  maxAdjustment:clamp(Number(process.env.CALIBRATION_MAX_WEIGHT_ADJUSTMENT||.25),.05,.40),
  lookbackRows:Math.max(500,Number(process.env.CALIBRATION_LOOKBACK_ROWS||20000)),
  trainSize:Math.max(25,Number(process.env.CALIBRATION_WALK_FORWARD_TRAIN||100)),
  testSize:Math.max(10,Number(process.env.CALIBRATION_WALK_FORWARD_TEST||25))
 };
}

function groupRows(rows:HistoricalPrediction[]){
 const groups=new Map<string,HistoricalPrediction[]>();
 for(const row of rows){
  const key=[row.modelName,row.sport,row.marketKey].join('|');
  const list=groups.get(key)||[];
  list.push(row);
  groups.set(key,list);
 }
 return groups;
}

function evaluateGroup(modelName:string,sport:string,marketKey:string,rows:HistoricalPrediction[],options:RecalibrationOptions):RecalibrationGroup{
 const sorted=[...rows].sort((a,b)=>new Date(a.occurredAt).getTime()-new Date(b.occurredAt).getTime());
 const holdoutSize=Math.max(options.minHoldout,Math.floor(sorted.length*.25));
 const holdout=sorted.slice(Math.max(0,sorted.length-holdoutSize));
 const allSummary=summarizeBacktest(sorted);
 const holdoutSummary=summarizeBacktest(holdout);
 const calibration=calibrationSummary(sorted);
 const perf=rollingModelPerformance(sorted)[0];
 const folds=walkForward(sorted,Math.min(options.trainSize,Math.max(25,Math.floor(sorted.length*.6))),Math.min(options.testSize,Math.max(10,Math.floor(sorted.length*.2))));
 const avgFoldBrier=folds.length?folds.reduce((s,x)=>s+x.test.brierScore,0)/folds.length:holdoutSummary.brierScore;
 const avgFoldLog=folds.length?folds.reduce((s,x)=>s+x.test.logLoss,0)/folds.length:holdoutSummary.logLoss;

 let promoted=true;
 let reason='Promoted after minimum-sample and holdout checks';
 if(sorted.length<options.minSample){promoted=false;reason=`Held: ${sorted.length} samples < ${options.minSample} minimum`;}
 else if(holdout.length<options.minHoldout){promoted=false;reason=`Held: ${holdout.length} holdout samples < ${options.minHoldout} minimum`;}
 else if(holdoutSummary.brierScore>.32||holdoutSummary.logLoss>.85){
  promoted=false;
  reason=`Held: holdout quality failed (Brier ${holdoutSummary.brierScore.toFixed(3)}, log loss ${holdoutSummary.logLoss.toFixed(3)})`;
 }else if(folds.length&&avgFoldBrier>.32){
  promoted=false;
  reason=`Held: walk-forward Brier ${avgFoldBrier.toFixed(3)} exceeded 0.320`;
 }

 const decayedScore=perf?.decayedScore??0;
 const avgClv=perf?.avgClv??0;
 const calibrationError=calibration.meanAbsoluteCalibrationError;
 const qualitySignal=
   (decayedScore-.5)*.75
   - calibrationError*.90
   - Math.max(0,avgFoldBrier-.25)*.80
   - Math.max(0,avgFoldLog-.693)*.15
   + clamp(avgClv,-.05,.05)*1.2;
 const rawMultiplier=1+qualitySignal;
 const shrinkage=sorted.length/(sorted.length+options.shrinkageSamples);
 const shrunk=1+(rawMultiplier-1)*shrinkage;
 const multiplier=promoted
   ?clamp(shrunk,1-options.maxAdjustment,1+options.maxAdjustment)
   :1;

 return {
  modelName,sport,marketKey,sampleSize:sorted.length,holdoutSampleSize:holdout.length,
  multiplier,promoted,reason,calibrationError,decayedScore,avgClv,
  brierScore:allSummary.brierScore,logLoss:allSummary.logLoss,roi:allSummary.roi,
  walkForwardFolds:folds.length,holdoutBrierScore:holdoutSummary.brierScore,holdoutLogLoss:holdoutSummary.logLoss
 };
}

export function evaluateRecalibration(rows:HistoricalPrediction[],options=defaultRecalibrationOptions()){
 const groups=groupRows(rows);
 return [...groups.entries()].map(([key,group])=>{
  const [modelName,sport,marketKey]=key.split('|');
  return evaluateGroup(modelName,sport,marketKey,group,options);
 }).sort((a,b)=>{
  if(a.promoted!==b.promoted)return a.promoted?-1:1;
  return Math.abs(b.multiplier-1)-Math.abs(a.multiplier-1);
 });
}

export async function runRecalibration(options=defaultRecalibrationOptions()){
 const sql=db();
 if(!sql)return {ok:true,mode:'dry-run' as const,rows:0,groups:[],options};

 const modelVersion=process.env.MODEL_VERSION||'edgeforce-v29';
 const [run]=await sql`
  insert into recalibration_runs(model_version,status)
  values(${modelVersion},'running')
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
  const groups=evaluateRecalibration(history,options);

  for(const g of groups){
   const sourceRows=history.filter(x=>x.modelName===g.modelName&&x.sport===g.sport&&x.marketKey===g.marketKey);
   const calibration=calibrationSummary(sourceRows);
   await sql`
    insert into model_calibration_profiles(
     model_name,sport,market_key,sample_size,calibration_error,
     overconfident_samples,underconfident_samples,buckets,as_of
    ) values(
     ${g.modelName},${g.sport},${g.marketKey},${g.sampleSize},${g.calibrationError},
     ${calibration.overconfidentSamples},${calibration.underconfidentSamples},
     ${sql.json(calibration.buckets)},now()
    )
   `;
   await sql`
    insert into rolling_model_rankings(
     model_name,sport,market_key,sample_size,decayed_score,confidence_label,
     brier_score,log_loss,roi,avg_clv,calibration_error,as_of
    ) values(
     ${g.modelName},${g.sport},${g.marketKey},${g.sampleSize},${g.decayedScore},
     ${g.sampleSize<options.minSample?'INSUFFICIENT':g.decayedScore>=.72&&g.calibrationError<=.06?'HIGH':g.decayedScore>=.62?'MEDIUM':'LOW'},
     ${g.brierScore},${g.logLoss},${g.roi},${g.avgClv},${g.calibrationError},now()
    )
   `;
   await sql`
    insert into learned_model_weight_snapshots(
     model_name,sport,market_key,multiplier,sample_size,calibration_error,decayed_score,avg_clv,
     as_of,model_version,holdout_sample_size,brier_score,log_loss,roi,confidence_label,promoted,reason
    ) values(
     ${g.modelName},${g.sport},${g.marketKey},${g.multiplier},${g.sampleSize},${g.calibrationError},
     ${g.decayedScore},${g.avgClv},now(),${modelVersion},${g.holdoutSampleSize},${g.brierScore},
     ${g.logLoss},${g.roi},${g.promoted?'PROMOTED':'HELD'},${g.promoted},${g.reason}
    )
   `;
  }

  const promoted=groups.filter(x=>x.promoted).length;
  await sql`
   update recalibration_runs set
    completed_at=now(),status='completed',prediction_rows=${history.length},
    groups_evaluated=${groups.length},groups_promoted=${promoted},groups_held=${groups.length-promoted},
    metrics=${sql.json({options,topAdjustments:groups.filter(x=>x.promoted).slice(0,20)})}
   where id=${run.id}
  `;
  return {ok:true,mode:'database' as const,runId:Number(run.id),rows:history.length,groups,promoted,held:groups.length-promoted,options};
 }catch(error){
  await sql`
   update recalibration_runs set completed_at=now(),status='failed',error_text=${error instanceof Error?error.message:'recalibration failed'}
   where id=${run.id}
  `.catch(()=>undefined);
  throw error;
 }
}
