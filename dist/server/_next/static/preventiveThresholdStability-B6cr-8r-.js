import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";var n=e=>Math.max(0,Math.min(1,e));function r(e){let t=e.current,r=e.previous,i=[],a=r?Math.max(Math.abs(t.recommendThreshold-r.recommendThreshold)/.12,Math.abs(t.confidenceFloor-r.confidenceFloor)/.18,Math.abs(t.riskFloor-r.riskFloor)/.14,Math.abs(t.rejectEffectivenessCeiling-r.rejectEffectivenessCeiling)/.12):0,o=e.recent.map(e=>Number(e.sourceCalibrationError||0)),s=o.length>=2?Math.max(...o)-Math.min(...o):0,c=n((t.sourceBrierScore-.16)/.2),l=n((t.sourceCalibrationError-.08)/.2),u=e.recent.slice(-6).reduce((e,t,n,r)=>n>0&&t.mode!==r[n-1].mode?e+1:e,0),d=n(Math.min(1,a)*.35+n(s/.18)*.25+c*.2+l*.15+n(u/4)*.05),f=`STABLE`;return d>=.72||a>=.85?(f=`ROLLBACK`,i.push(`Adaptive threshold movement is unstable enough to require rollback to the last known-safe threshold snapshot.`)):d>=.48||a>=.55?(f=`WATCH`,i.push(`Threshold drift is elevated; continue using current thresholds but increase supervision.`)):i.push(`Adaptive thresholds are stable within bounded drift limits.`),u>=3&&i.push(`Frequent threshold-mode switching contributed to instability.`),t.sourceCalibrationError>.18&&i.push(`Calibration error is elevated.`),t.sourceBrierScore>.26&&i.push(`Brier score is elevated.`),{status:f,driftScore:n(a),instabilityScore:d,rollbackRequired:f===`ROLLBACK`,rationale:i}}async function i(){let t=e();return t?(await t`
  select id,recommend_threshold::float as "recommendThreshold",confidence_floor::float as "confidenceFloor",
   risk_floor::float as "riskFloor",reject_effectiveness_ceiling::float as "rejectEffectivenessCeiling",
   source_calibration_error::float as "sourceCalibrationError",source_brier_score::float as "sourceBrierScore",
   mode,generated_at as "generatedAt"
  from preventive_decision_threshold_snapshots
  order by generated_at desc limit 12
 `).map(e=>({snapshotId:Number(e.id),recommendThreshold:Number(e.recommendThreshold),confidenceFloor:Number(e.confidenceFloor),riskFloor:Number(e.riskFloor),rejectEffectivenessCeiling:Number(e.rejectEffectivenessCeiling),sourceCalibrationError:Number(e.sourceCalibrationError||0),sourceBrierScore:Number(e.sourceBrierScore||0),mode:String(e.mode||`BASELINE`)})):[]}async function a(){let t=e();if(!t)return null;let[n]=await t`
  select t.id,t.recommend_threshold::float as "recommendThreshold",t.confidence_floor::float as "confidenceFloor",
   t.risk_floor::float as "riskFloor",t.reject_effectiveness_ceiling::float as "rejectEffectivenessCeiling",
   t.source_sample_size as "sourceSampleSize",t.source_brier_score::float as "sourceBrierScore",
   t.source_calibration_error::float as "sourceCalibrationError",t.mode,t.rationale
  from preventive_decision_threshold_snapshots t
  where t.source_calibration_error<=.12 and t.source_brier_score<=.22
  order by t.generated_at desc limit 1
 `;return n||null}async function o(){let n=e();if(!n)return{configured:!1,status:`STABLE`,driftScore:0,instabilityScore:0,rollbackRequired:!1,rollbackApplied:!1,rationale:[`Database is not configured.`]};let o=await i(),s=o[0];if(!s)return{configured:!0,status:`STABLE`,driftScore:0,instabilityScore:0,rollbackRequired:!1,rollbackApplied:!1,rationale:[`No adaptive threshold history exists yet.`]};let c=r({current:s,previous:o[1]||null,recent:[...o].reverse()}),l=await a(),u=!1;c.rollbackRequired&&l&&Number(l.id)!==Number(s.snapshotId)&&(await n`
   update preventive_decision_threshold_state set
    recommend_threshold=${Number(l.recommendThreshold)},
    confidence_floor=${Number(l.confidenceFloor)},
    risk_floor=${Number(l.riskFloor)},
    reject_effectiveness_ceiling=${Number(l.rejectEffectivenessCeiling)},
    source_sample_size=${Number(l.sourceSampleSize||0)},
    source_brier_score=${Number(l.sourceBrierScore||0)},
    source_calibration_error=${Number(l.sourceCalibrationError||0)},
    mode=${String(l.mode||`BASELINE`)},
    rationale=${n.json([...Array.isArray(l.rationale)?l.rationale.map(String):[],`V83 restored this last known-safe threshold snapshot after instability detection.`])},
    updated_at=now()
   where singleton_key=1
  `,u=!0);let[d]=await n`select rollback_count as "rollbackCount" from preventive_threshold_stability_state where singleton_key=1`,f=Number(d?.rollbackCount||0)+(u?1:0);return await n`
  insert into preventive_threshold_stability_state(
   singleton_key,status,active_snapshot_id,last_safe_snapshot_id,rollback_count,drift_score,instability_score,rationale,updated_at
  ) values(
   1,${c.status},${s.snapshotId||null},${l?.id?Number(l.id):null},
   ${f},${c.driftScore},${c.instabilityScore},${n.json(c.rationale)},now()
  )
  on conflict(singleton_key) do update set
   status=excluded.status,active_snapshot_id=excluded.active_snapshot_id,last_safe_snapshot_id=excluded.last_safe_snapshot_id,
   rollback_count=excluded.rollback_count,drift_score=excluded.drift_score,instability_score=excluded.instability_score,
   rationale=excluded.rationale,updated_at=now()
 `,await n`
  insert into preventive_threshold_stability_snapshots(
   model_version,status,active_snapshot_id,last_safe_snapshot_id,drift_score,instability_score,rollback_applied,rationale
  ) values(
   ${t.modelVersion},${c.status},${s.snapshotId||null},${l?.id?Number(l.id):null},
   ${c.driftScore},${c.instabilityScore},${u},${n.json(c.rationale)}
  )
 `,{configured:!0,...c,rollbackApplied:u,rollbackCount:f,lastSafeSnapshotId:l?.id?Number(l.id):null}}async function s(){let t=e();if(!t)return{status:`STABLE`,activeSnapshotId:null,lastSafeSnapshotId:null,driftScore:0,instabilityScore:0,rollbackCount:0,rollbackApplied:!1,rationale:[`Database is not configured.`],updatedAt:null,recent:[]};try{let[e]=await t`
   select status,active_snapshot_id as "activeSnapshotId",last_safe_snapshot_id as "lastSafeSnapshotId",
    rollback_count as "rollbackCount",drift_score::float as "driftScore",instability_score::float as "instabilityScore",
    rationale,updated_at as "updatedAt"
   from preventive_threshold_stability_state where singleton_key=1
  `,n=await t`
   select id,status,drift_score::float as "driftScore",instability_score::float as "instabilityScore",
    rollback_applied as "rollbackApplied",generated_at as "generatedAt"
   from preventive_threshold_stability_snapshots order by generated_at desc limit 20
  `;return{status:String(e?.status||`STABLE`),activeSnapshotId:e?.activeSnapshotId==null?null:Number(e.activeSnapshotId),lastSafeSnapshotId:e?.lastSafeSnapshotId==null?null:Number(e.lastSafeSnapshotId),rollbackCount:Number(e?.rollbackCount||0),driftScore:Number(e?.driftScore||0),instabilityScore:Number(e?.instabilityScore||0),rollbackApplied:!!n[0]?.rollbackApplied,rationale:Array.isArray(e?.rationale)?e.rationale.map(String):[],updatedAt:e?.updatedAt?new Date(e.updatedAt).toISOString():null,recent:n}}catch{return{status:`STABLE`,activeSnapshotId:null,lastSafeSnapshotId:null,driftScore:0,instabilityScore:0,rollbackCount:0,rollbackApplied:!1,rationale:[],updatedAt:null,recent:[]}}}export{s as n,o as r,r as t};