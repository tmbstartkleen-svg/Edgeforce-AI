import {db} from './db';
import type {HistoricalPrediction} from './backtest';
import {summarizeBacktest} from './backtest';
import {calibrationSummary} from './modelCalibration';
import {rollingModelPerformance} from './modelPerformance';

type LearningRow=HistoricalPrediction & {resultId:number;propType?:string|null;playerName?:string|null};
const bands=[
  {label:'65-69',min:.65,max:.70},{label:'70-74',min:.70,max:.75},{label:'75-79',min:.75,max:.80},
  {label:'80-84',min:.80,max:.85},{label:'85-89',min:.85,max:.90},{label:'90+',min:.90,max:1.001}
];
function bandMetrics(rows:LearningRow[]){
  return bands.map(b=>{
    const r=rows.filter(x=>x.predicted>=b.min&&x.predicted<b.max);
    const summary=summarizeBacktest(r);
    return {...b,sampleSize:r.length,predictedAvg:r.length?r.reduce((s,x)=>s+x.predicted,0)/r.length:0,hitRate:summary.hitRate,brierScore:summary.brierScore,roi:summary.roi,avgClv:summary.avgClv};
  });
}
export async function loadLearningRows(lookbackDays=Math.max(30,Number(process.env.CALIBRATION_LOOKBACK_DAYS)||365)):Promise<LearningRow[]>{
  const sql=db();if(!sql)return [];
  const rows=await sql`
    select br.id as "resultId",br.settled_at as "occurredAt",e.sport,mr.market_key as "marketKey",mr.model_version as "modelName",
      coalesce(br.simulation_probability,mr.simulation_probability,mr.model_probability)::float as predicted,
      coalesce(br.offered_odds,0) as odds,case when br.result='win' then 1 else 0 end as outcome,br.closing_odds as "closingOdds",br.prop_type as "propType",br.player_name as "playerName"
    from bet_results br join model_runs mr on mr.id=br.model_run_id join events e on e.id=mr.event_id
    where br.result in ('win','loss') and br.settled_at >= now()-make_interval(days => ${lookbackDays})
      and coalesce(br.simulation_probability,mr.simulation_probability,mr.model_probability) >= .65 and coalesce(br.offered_odds,0) <> 0
    order by br.settled_at asc
  `;
  return rows as unknown as LearningRow[];
}
export async function runAutomatedLearning(){
  const sql=db();if(!sql)return {configured:false,sampleSize:0,runId:null};
  const lookbackDays=Math.max(30,Number(process.env.CALIBRATION_LOOKBACK_DAYS)||365);
  const rows=await loadLearningRows(lookbackDays),now=new Date();
  const start=new Date(now.getTime()-lookbackDays*86400000).toISOString().slice(0,10),end=now.toISOString().slice(0,10);
  const overall=summarizeBacktest(rows),overallCalibration=calibrationSummary(rows);
  const inserted=await sql`
    insert into model_learning_runs(model_version,status,sample_size,brier_score,log_loss,calibration_error,roi,avg_clv,period_start,period_end,notes)
    values(${process.env.MODEL_VERSION||'edgeforce-v29'},'completed',${rows.length},${overall.brierScore},${overall.logLoss},${overallCalibration.meanAbsoluteCalibrationError},
      ${overall.roi},${overall.avgClv},${start},${end},${sql.json({lookbackDays,officialFloor:.65} as any)}) returning id
  ` as unknown as Array<{id:number}>;
  const runId=inserted[0]?.id??null,asOf=now.toISOString();
  const groups=new Map<string,LearningRow[]>();groups.set('ALL|ALL',rows);
  for(const row of rows)for(const key of [[row.sport,'ALL'],[row.sport,row.marketKey]] as const){const k=key.join('|'),list=groups.get(k)||[];list.push(row);groups.set(k,list)}
  let bandRows=0;
  for(const [key,group] of groups){
    const [sport,marketKey]=key.split('|');
    for(const b of bandMetrics(group)){
      await sql`
        insert into calibration_band_metrics(learning_run_id,model_version,sport,market_key,band_label,min_probability,max_probability,sample_size,predicted_average,hit_rate,brier_score,roi,avg_clv,period_start,period_end,as_of)
        values(${runId},${process.env.MODEL_VERSION||'edgeforce-v29'},${sport},${marketKey},${b.label},${b.min},${b.max},${b.sampleSize},${b.predictedAvg},${b.hitRate},${b.brierScore},${b.roi},${b.avgClv},${start},${end},${asOf})
      `;bandRows++;
    }
  }
  const propGroups=new Map<string,LearningRow[]>();
  for(const row of rows.filter(x=>x.propType)){
    const key=[row.sport,row.propType].join('|');
    const list=propGroups.get(key)||[];list.push(row);propGroups.set(key,list);
  }
  let propMetrics=0;
  for(const [key,group] of propGroups){
    const [sport,propType]=key.split('|');
    const summary=summarizeBacktest(group),cal=calibrationSummary(group);
    const predictedAverage=group.reduce((s,x)=>s+x.predicted,0)/Math.max(1,group.length);
    await sql`
      insert into prop_performance_metrics(model_version,sport,prop_type,sample_size,predicted_average,hit_rate,brier_score,roi,avg_clv,calibration_error,as_of)
      values(${process.env.MODEL_VERSION||'edgeforce-v29'},${sport},${propType},${group.length},${predictedAverage},${summary.hitRate},${summary.brierScore},${summary.roi},${summary.avgClv},${cal.meanAbsoluteCalibrationError},${asOf})
    `;
    propMetrics++;
  }

  const performance=rollingModelPerformance(rows,now);
  for(const p of performance)await sql`
    insert into rolling_model_rankings(model_name,sport,market_key,sample_size,decayed_score,confidence_label,brier_score,log_loss,roi,avg_clv,calibration_error,as_of)
    values(${p.modelName},${p.sport},${p.marketKey},${p.sampleSize},${p.decayedScore},${p.confidenceLabel},${p.brierScore},${p.logLoss},${p.roi},${p.avgClv},${p.calibrationError},${asOf})
  `;
  for(const [key,group] of groups){
    if(key==='ALL|ALL')continue;
    const [sport,marketKey]=key.split('|'),byModel=new Map<string,LearningRow[]>();
    for(const row of group){const list=byModel.get(row.modelName)||[];list.push(row);byModel.set(row.modelName,list)}
    for(const [modelName,modelRows] of byModel){
      const c=calibrationSummary(modelRows);
      await sql`
        insert into model_calibration_profiles(model_name,sport,market_key,sample_size,calibration_error,overconfident_samples,underconfident_samples,buckets,as_of)
        values(${modelName},${sport},${marketKey},${c.sampleSize},${c.meanAbsoluteCalibrationError},${c.overconfidentSamples},${c.underconfidentSamples},${sql.json(c.buckets as any)},${asOf})
      `;
    }
  }
  return {configured:true,runId,sampleSize:rows.length,bandRows,propMetrics,rankings:performance.length,overall,calibration:overallCalibration};
}
export async function getLearningDashboard(){
  const sql=db();if(!sql)return {configured:false,latestRun:null,bands:[],rankings:[],props:[]};
  const runs=await sql`
    select id,model_version as "modelVersion",status,sample_size as "sampleSize",brier_score::float as "brierScore",log_loss::float as "logLoss",
      calibration_error::float as "calibrationError",roi::float,avg_clv::float as "avgClv",period_start as "periodStart",period_end as "periodEnd",created_at as "createdAt"
    from model_learning_runs order by created_at desc limit 1
  `;
  const latestRun=(runs as unknown as Array<Record<string,unknown>>)[0]||null;
  if(!latestRun)return {configured:true,latestRun:null,bands:[],rankings:[],props:[]};
  const runId=Number(latestRun.id);
  const bandRows=await sql`
    select band_label as "bandLabel",min_probability::float as "minProbability",max_probability::float as "maxProbability",sample_size as "sampleSize",
      predicted_average::float as "predictedAverage",hit_rate::float as "hitRate",brier_score::float as "brierScore",roi::float,avg_clv::float as "avgClv"
    from calibration_band_metrics where learning_run_id=${runId} and sport='ALL' and market_key='ALL' order by min_probability asc
  `;
  const rankingRows=await sql`
    select model_name as "modelName",sport,market_key as "marketKey",sample_size as "sampleSize",decayed_score::float as "decayedScore",
      confidence_label as "confidenceLabel",brier_score::float as "brierScore",roi::float,avg_clv::float as "avgClv",calibration_error::float as "calibrationError"
    from rolling_model_rankings where as_of=(select max(as_of) from rolling_model_rankings) order by decayed_score desc limit 12
  `;
  const propRows=await sql`
    select sport,prop_type as "propType",sample_size as "sampleSize",predicted_average::float as "predictedAverage",
      hit_rate::float as "hitRate",brier_score::float as "brierScore",roi::float,avg_clv::float as "avgClv",
      calibration_error::float as "calibrationError"
    from prop_performance_metrics
    where as_of=(select max(as_of) from prop_performance_metrics)
    order by sample_size desc,hit_rate desc limit 20
  `;
  return {configured:true,latestRun,bands:bandRows,rankings:rankingRows,props:propRows};
}
