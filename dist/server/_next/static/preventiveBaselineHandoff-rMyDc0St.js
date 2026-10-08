import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";import{t as n}from"./preventiveChampionBaseline-CxqOD8Ok.js";import{n as r}from"./preventiveBaselineSuccession-DEO5-y_E.js";function i(e){let t=[];return e.hasActiveChampion?(t.push(`An active champion baseline already exists; successor promotion is not allowed.`),{status:`IDLE`,eligible:!1,rationale:t}):e.successionStatus===`READY`&&e.readinessScore>=.8&&e.candidateCalibrationError<=.1&&e.candidateBrierScore<=.2&&e.candidateSampleSize>=25&&e.sourceWindows>=3?(t.push(`READY successor passed strengthened promotion thresholds and may become the new champion baseline.`),{status:`PROMOTE`,eligible:!0,rationale:t}):(t.push(`Successor is not yet strong enough for champion handoff.`),{status:`WAITING`,eligible:!1,rationale:t})}async function a(){let a=e(),[o,s,c]=await Promise.all([n(),r(),a?a`select promotion_count as "promotionCount" from preventive_baseline_handoff_state where singleton_key=1`:Promise.resolve([])]),l=i({hasActiveChampion:!!o?.promotedAt,successionStatus:String(s?.status||`IDLE`),readinessScore:Number(s?.readinessScore||0),candidateCalibrationError:Number(s?.candidateCalibrationError||0),candidateBrierScore:Number(s?.candidateBrierScore||0),candidateSampleSize:Number(s?.candidateSampleSize||0),sourceWindows:Number(s?.sourceWindows||0)}),u=!1;a&&l.eligible&&(await a`
   insert into preventive_champion_baseline_state(
    singleton_key,calibration_error,brier_score,sample_size,source,promoted_from_stage,promoted_at,rationale,updated_at
   ) values(
    1,${Number(s?.candidateCalibrationError||0)},${Number(s?.candidateBrierScore||0)},
    ${Number(s?.candidateSampleSize||0)},'SUCCESSION_CHAMPION',null,now(),
    ${a.json(l.rationale)},now()
   )
   on conflict(singleton_key) do update set
    calibration_error=excluded.calibration_error,brier_score=excluded.brier_score,sample_size=excluded.sample_size,
    source=excluded.source,promoted_from_stage=null,promoted_at=excluded.promoted_at,
    rationale=excluded.rationale,updated_at=now()
  `,await a`
   insert into preventive_champion_baseline_snapshots(
    model_version,calibration_error,brier_score,sample_size,source,promoted_from_stage,rationale
   ) values(
    ${t.modelVersion},${Number(s?.candidateCalibrationError||0)},
    ${Number(s?.candidateBrierScore||0)},${Number(s?.candidateSampleSize||0)},
    'SUCCESSION_CHAMPION',null,${a.json(l.rationale)}
   )
  `,await a`
   update preventive_champion_baseline_health_state
   set status='ACTIVE',drift_score=0,age_days=0,retired=false,last_reason='V90 successor promoted to champion baseline.',updated_at=now()
   where singleton_key=1
  `,await a`
   update preventive_baseline_succession_state
   set status='IDLE',last_reason='V90 successor promoted; succession cycle completed.',updated_at=now()
   where singleton_key=1
  `,u=!0);let d=Number(c?.[0]?.promotionCount||0)+(u?1:0),f=u?`PROMOTED`:l.status;return a&&(await a`
   insert into preventive_baseline_handoff_state(
    singleton_key,status,promoted,source_readiness_score,promoted_calibration_error,
    promoted_brier_score,promoted_sample_size,promotion_count,last_reason,updated_at
   ) values(
    1,${f},${u},${Number(s?.readinessScore||0)},
    ${Number(s?.candidateCalibrationError||0)},${Number(s?.candidateBrierScore||0)},
    ${Number(s?.candidateSampleSize||0)},${d},${l.rationale.join(` `)},now()
   )
   on conflict(singleton_key) do update set
    status=excluded.status,promoted=excluded.promoted,source_readiness_score=excluded.source_readiness_score,
    promoted_calibration_error=excluded.promoted_calibration_error,promoted_brier_score=excluded.promoted_brier_score,
    promoted_sample_size=excluded.promoted_sample_size,promotion_count=excluded.promotion_count,
    last_reason=excluded.last_reason,updated_at=now()
  `,await a`
   insert into preventive_baseline_handoff_snapshots(
    model_version,status,promoted,source_readiness_score,calibration_error,brier_score,sample_size,rationale
   ) values(
    ${t.modelVersion},${f},${u},${Number(s?.readinessScore||0)},
    ${Number(s?.candidateCalibrationError||0)},${Number(s?.candidateBrierScore||0)},
    ${Number(s?.candidateSampleSize||0)},${a.json(l.rationale)}
   )
  `),{configured:!!a,...l,status:f,promoted:u,promotionCount:d}}async function o(){let t=e();if(!t)return{status:`IDLE`,promoted:!1,promotionCount:0,sourceReadinessScore:0,promotedCalibrationError:0,promotedBrierScore:0,promotedSampleSize:0,rationale:[],recent:[]};try{let[e]=await t`
   select status,promoted,promotion_count as "promotionCount",
    source_readiness_score::float as "sourceReadinessScore",
    promoted_calibration_error::float as "promotedCalibrationError",
    promoted_brier_score::float as "promotedBrierScore",
    promoted_sample_size as "promotedSampleSize",
    last_reason as "lastReason",updated_at as "updatedAt"
   from preventive_baseline_handoff_state where singleton_key=1
  `,n=await t`
   select id,status,promoted,source_readiness_score::float as "sourceReadinessScore",generated_at as "generatedAt"
   from preventive_baseline_handoff_snapshots order by generated_at desc limit 20
  `;return{...e,rationale:e?.lastReason?[String(e.lastReason)]:[],recent:n}}catch{return{status:`IDLE`,promoted:!1,promotionCount:0,sourceReadinessScore:0,promotedCalibrationError:0,promotedBrierScore:0,promotedSampleSize:0,rationale:[],recent:[]}}}export{o as n,a as r,i as t};