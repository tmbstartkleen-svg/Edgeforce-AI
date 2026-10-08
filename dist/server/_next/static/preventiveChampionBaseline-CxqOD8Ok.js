import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";import{n}from"./preventiveDecisionCalibration-B_erbWue.js";import{n as r}from"./preventiveThresholdProbation-36jOuLtj.js";import{n as i}from"./preventiveProbationPerformance-DwhqZeeb.js";function a(e){let t=[],n=e.probationState===`FULL`&&e.probationStage>=4&&e.performanceStatus===`STABLE`&&e.degradationScore<.3&&e.calibrationError<=.1&&e.brierScore<=.2&&e.sampleSize>=20;return n?t.push(`Full staged rollout completed with stable performance and mature calibration evidence.`):t.push(`Champion baseline promotion criteria are not yet satisfied.`),{eligible:n,rationale:t}}async function o(){let o=e(),[s,c,l]=await Promise.all([r(),i(),n()]),u={...a({probationState:String(s?.state||`INACTIVE`),probationStage:Number(s?.stage||0),performanceStatus:String(c?.status||`INACTIVE`),degradationScore:Number(c?.degradationScore||0),calibrationError:Number(l?.calibrationError||0),brierScore:Number(l?.brierScore||0),sampleSize:Number(l?.sampleSize||0)}),calibrationError:Number(l?.calibrationError||0),brierScore:Number(l?.brierScore||0),sampleSize:Number(l?.sampleSize||0),probationState:String(s?.state||`INACTIVE`),probationStage:Number(s?.stage||0)};if(!o)return{configured:!1,promoted:!1,...u};let d=!1;return u.eligible&&(await o`
   insert into preventive_champion_baseline_state(
    singleton_key,calibration_error,brier_score,sample_size,source,promoted_from_stage,promoted_at,rationale,updated_at
   ) values(
    1,${u.calibrationError},${u.brierScore},${u.sampleSize},'FULL_PROBATION_CHAMPION',
    ${u.probationStage},now(),${o.json(u.rationale)},now()
   )
   on conflict(singleton_key) do update set
    calibration_error=excluded.calibration_error,brier_score=excluded.brier_score,sample_size=excluded.sample_size,
    source=excluded.source,promoted_from_stage=excluded.promoted_from_stage,promoted_at=excluded.promoted_at,
    rationale=excluded.rationale,updated_at=now()
  `,await o`
   insert into preventive_champion_baseline_snapshots(
    model_version,calibration_error,brier_score,sample_size,source,promoted_from_stage,rationale
   ) values(
    ${t.modelVersion},${u.calibrationError},${u.brierScore},${u.sampleSize},
    'FULL_PROBATION_CHAMPION',${u.probationStage},${o.json(u.rationale)}
   )
  `,d=!0),{configured:!0,promoted:d,...u}}async function s(){let t=e();if(!t)return{source:`RECOVERY_BASELINE`,calibrationError:0,brierScore:0,sampleSize:0,promotedFromStage:null,promotedAt:null,rationale:[],recent:[]};try{let[e]=await t`
   select calibration_error::float as "calibrationError",brier_score::float as "brierScore",sample_size as "sampleSize",
    source,promoted_from_stage as "promotedFromStage",promoted_at as "promotedAt",rationale
   from preventive_champion_baseline_state where singleton_key=1
  `,n=await t`
   select id,calibration_error::float as "calibrationError",brier_score::float as "brierScore",
    sample_size as "sampleSize",source,generated_at as "generatedAt"
   from preventive_champion_baseline_snapshots order by generated_at desc limit 20
  `;return e?{source:String(e.source||`RECOVERY_BASELINE`),calibrationError:Number(e.calibrationError||0),brierScore:Number(e.brierScore||0),sampleSize:Number(e.sampleSize||0),promotedFromStage:e.promotedFromStage==null?null:Number(e.promotedFromStage),promotedAt:e.promotedAt?new Date(e.promotedAt).toISOString():null,rationale:Array.isArray(e.rationale)?e.rationale.map(String):[],recent:n}:{source:`RECOVERY_BASELINE`,calibrationError:0,brierScore:0,sampleSize:0,promotedFromStage:null,promotedAt:null,rationale:[],recent:n}}catch{return{source:`RECOVERY_BASELINE`,calibrationError:0,brierScore:0,sampleSize:0,promotedFromStage:null,promotedAt:null,rationale:[],recent:[]}}}export{o as n,a as r,s as t};