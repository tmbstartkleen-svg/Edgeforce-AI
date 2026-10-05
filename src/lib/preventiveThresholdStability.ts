import {db} from './db';
import {RELEASE} from './releaseManifest';

export type ThresholdVector={
 recommendThreshold:number;
 confidenceFloor:number;
 riskFloor:number;
 rejectEffectivenessCeiling:number;
 sourceCalibrationError:number;
 sourceBrierScore:number;
 mode:string;
 snapshotId?:number|null;
};

export type ThresholdStabilityResult={
 status:'STABLE'|'WATCH'|'ROLLBACK';
 driftScore:number;
 instabilityScore:number;
 rollbackRequired:boolean;
 rationale:string[];
};

const clamp=(n:number)=>Math.max(0,Math.min(1,n));

export function evaluateThresholdStability(input:{
 current:ThresholdVector;
 previous?:ThresholdVector|null;
 recent:ThresholdVector[];
}):ThresholdStabilityResult{
 const c=input.current;
 const p=input.previous;
 const rationale:string[]=[];
 const drift=p?Math.max(
  Math.abs(c.recommendThreshold-p.recommendThreshold)/.12,
  Math.abs(c.confidenceFloor-p.confidenceFloor)/.18,
  Math.abs(c.riskFloor-p.riskFloor)/.14,
  Math.abs(c.rejectEffectivenessCeiling-p.rejectEffectivenessCeiling)/.12
 ):0;
 const recentErrors=input.recent.map(x=>Number(x.sourceCalibrationError||0));
 const errorSwing=recentErrors.length>=2?Math.max(...recentErrors)-Math.min(...recentErrors):0;
 const brierPenalty=clamp((c.sourceBrierScore-.16)/.20);
 const calibrationPenalty=clamp((c.sourceCalibrationError-.08)/.20);
 const modeFlips=input.recent.slice(-6).reduce((n,x,i,a)=>i>0&&x.mode!==a[i-1].mode?n+1:n,0);
 const instabilityScore=clamp(
  Math.min(1,drift)*.35+
  clamp(errorSwing/.18)*.25+
  brierPenalty*.20+
  calibrationPenalty*.15+
  clamp(modeFlips/4)*.05
 );
 let status:ThresholdStabilityResult['status']='STABLE';
 if(instabilityScore>=.72||drift>=.85){
  status='ROLLBACK';
  rationale.push('Adaptive threshold movement is unstable enough to require rollback to the last known-safe threshold snapshot.');
 }else if(instabilityScore>=.48||drift>=.55){
  status='WATCH';
  rationale.push('Threshold drift is elevated; continue using current thresholds but increase supervision.');
 }else{
  rationale.push('Adaptive thresholds are stable within bounded drift limits.');
 }
 if(modeFlips>=3)rationale.push('Frequent threshold-mode switching contributed to instability.');
 if(c.sourceCalibrationError>.18)rationale.push('Calibration error is elevated.');
 if(c.sourceBrierScore>.26)rationale.push('Brier score is elevated.');
 return {status,driftScore:clamp(drift),instabilityScore,rollbackRequired:status==='ROLLBACK',rationale};
}

async function loadThresholdHistory():Promise<ThresholdVector[]>{
 const sql=db();if(!sql)return [];
 const rows=await sql`
  select id,recommend_threshold::float as "recommendThreshold",confidence_floor::float as "confidenceFloor",
   risk_floor::float as "riskFloor",reject_effectiveness_ceiling::float as "rejectEffectivenessCeiling",
   source_calibration_error::float as "sourceCalibrationError",source_brier_score::float as "sourceBrierScore",
   mode,generated_at as "generatedAt"
  from preventive_decision_threshold_snapshots
  order by generated_at desc limit 12
 `;
 return (rows as any[]).map(row=>({
  snapshotId:Number(row.id),
  recommendThreshold:Number(row.recommendThreshold),
  confidenceFloor:Number(row.confidenceFloor),
  riskFloor:Number(row.riskFloor),
  rejectEffectivenessCeiling:Number(row.rejectEffectivenessCeiling),
  sourceCalibrationError:Number(row.sourceCalibrationError||0),
  sourceBrierScore:Number(row.sourceBrierScore||0),
  mode:String(row.mode||'BASELINE')
 }));
}

async function loadLastSafeSnapshot(){
 const sql=db();if(!sql)return null;
 const [row]=await sql`
  select t.id,t.recommend_threshold::float as "recommendThreshold",t.confidence_floor::float as "confidenceFloor",
   t.risk_floor::float as "riskFloor",t.reject_effectiveness_ceiling::float as "rejectEffectivenessCeiling",
   t.source_sample_size as "sourceSampleSize",t.source_brier_score::float as "sourceBrierScore",
   t.source_calibration_error::float as "sourceCalibrationError",t.mode,t.rationale
  from preventive_decision_threshold_snapshots t
  where t.source_calibration_error<=.12 and t.source_brier_score<=.22
  order by t.generated_at desc limit 1
 `;
 return row||null;
}

export async function runThresholdStabilityGovernor(){
 const sql=db();if(!sql)return {configured:false,status:'STABLE',driftScore:0,instabilityScore:0,rollbackRequired:false,rollbackApplied:false,rationale:['Database is not configured.']};
 const history=await loadThresholdHistory();
 const current=history[0];
 if(!current)return {configured:true,status:'STABLE',driftScore:0,instabilityScore:0,rollbackRequired:false,rollbackApplied:false,rationale:['No adaptive threshold history exists yet.']};
 const result=evaluateThresholdStability({current,previous:history[1]||null,recent:[...history].reverse()});
 const lastSafe=await loadLastSafeSnapshot();
 let rollbackApplied=false;
 if(result.rollbackRequired&&lastSafe&&Number(lastSafe.id)!==Number(current.snapshotId)){
  await sql`
   update preventive_decision_threshold_state set
    recommend_threshold=${Number(lastSafe.recommendThreshold)},
    confidence_floor=${Number(lastSafe.confidenceFloor)},
    risk_floor=${Number(lastSafe.riskFloor)},
    reject_effectiveness_ceiling=${Number(lastSafe.rejectEffectivenessCeiling)},
    source_sample_size=${Number(lastSafe.sourceSampleSize||0)},
    source_brier_score=${Number(lastSafe.sourceBrierScore||0)},
    source_calibration_error=${Number(lastSafe.sourceCalibrationError||0)},
    mode=${String(lastSafe.mode||'BASELINE')},
    rationale=${sql.json([...(Array.isArray(lastSafe.rationale)?lastSafe.rationale.map(String):[]),'V83 restored this last known-safe threshold snapshot after instability detection.'])},
    updated_at=now()
   where singleton_key=1
  `;
  rollbackApplied=true;
 }
 const [state]=await sql`select rollback_count as "rollbackCount" from preventive_threshold_stability_state where singleton_key=1`;
 const rollbackCount=Number(state?.rollbackCount||0)+(rollbackApplied?1:0);
 await sql`
  insert into preventive_threshold_stability_state(
   singleton_key,status,active_snapshot_id,last_safe_snapshot_id,rollback_count,drift_score,instability_score,rationale,updated_at
  ) values(
   1,${result.status},${current.snapshotId||null},${lastSafe?.id?Number(lastSafe.id):null},
   ${rollbackCount},${result.driftScore},${result.instabilityScore},${sql.json(result.rationale)},now()
  )
  on conflict(singleton_key) do update set
   status=excluded.status,active_snapshot_id=excluded.active_snapshot_id,last_safe_snapshot_id=excluded.last_safe_snapshot_id,
   rollback_count=excluded.rollback_count,drift_score=excluded.drift_score,instability_score=excluded.instability_score,
   rationale=excluded.rationale,updated_at=now()
 `;
 await sql`
  insert into preventive_threshold_stability_snapshots(
   model_version,status,active_snapshot_id,last_safe_snapshot_id,drift_score,instability_score,rollback_applied,rationale
  ) values(
   ${RELEASE.modelVersion},${result.status},${current.snapshotId||null},${lastSafe?.id?Number(lastSafe.id):null},
   ${result.driftScore},${result.instabilityScore},${rollbackApplied},${sql.json(result.rationale)}
  )
 `;
 return {configured:true,...result,rollbackApplied,rollbackCount,lastSafeSnapshotId:lastSafe?.id?Number(lastSafe.id):null};
}

export async function loadThresholdStabilitySummary(){
 const sql=db();
 if(!sql)return {status:'STABLE',driftScore:0,instabilityScore:0,rollbackCount:0,rollbackApplied:false,rationale:['Database is not configured.'],recent:[]};
 try{
  const [state]=await sql`
   select status,active_snapshot_id as "activeSnapshotId",last_safe_snapshot_id as "lastSafeSnapshotId",
    rollback_count as "rollbackCount",drift_score::float as "driftScore",instability_score::float as "instabilityScore",
    rationale,updated_at as "updatedAt"
   from preventive_threshold_stability_state where singleton_key=1
  `;
  const recent=await sql`
   select id,status,drift_score::float as "driftScore",instability_score::float as "instabilityScore",
    rollback_applied as "rollbackApplied",generated_at as "generatedAt"
   from preventive_threshold_stability_snapshots order by generated_at desc limit 20
  `;
  return {...state,rollbackApplied:Boolean((recent as any[])[0]?.rollbackApplied),recent};
 }catch{return {status:'STABLE',driftScore:0,instabilityScore:0,rollbackCount:0,rollbackApplied:false,rationale:[],recent:[]}}
}
