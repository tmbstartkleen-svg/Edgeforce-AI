import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";import{n}from"./preventiveDecisionCalibration-B_erbWue.js";import{t as r}from"./preventiveChampionBaseline-CxqOD8Ok.js";import{n as i}from"./preventiveBaselineHandoff-rMyDc0St.js";var a=e=>Math.max(0,Math.min(1,e));function o(e){let t=[];if(e.championSource!==`SUCCESSION_CHAMPION`)return{status:`IDLE`,validationStreak:0,degradationScore:0,revert:!1,rationale:[`No succession champion is active.`]};let n=Math.max(0,e.currentCalibrationError-e.baselineCalibrationError),r=Math.max(0,e.currentBrierScore-e.baselineBrierScore),i=a(Math.max(n/.08,r/.1));if(e.sampleSize<20)return t.push(`Succession champion is active, but post-handoff evidence is still immature.`),{status:`VALIDATING`,validationStreak:0,degradationScore:i,revert:!1,rationale:t};if(i>=.7)return t.push(`Post-handoff calibration degraded materially; revert the succession champion and return to the safe fallback path.`),{status:`REVERT`,validationStreak:0,degradationScore:i,revert:!0,rationale:t};if(!(e.currentCalibrationError<=.1&&e.currentBrierScore<=.2&&i<.35))return t.push(`Post-handoff results are not healthy enough to confirm the new champion; validation streak reset.`),{status:`VALIDATING`,validationStreak:0,degradationScore:i,revert:!1,rationale:t};let o=e.previousStatus===`CONFIRMED`?Math.max(3,e.previousStreak):e.previousStreak+1;return o>=3?(t.push(`Three consecutive healthy post-handoff windows passed; succession champion is confirmed.`),{status:`CONFIRMED`,validationStreak:o,degradationScore:i,revert:!1,rationale:t}):(t.push(`Healthy post-handoff validation window ${o}/3 passed.`),{status:`VALIDATING`,validationStreak:o,degradationScore:i,revert:!1,rationale:t})}async function s(){let t=e();if(!t)return null;try{let[e]=await t`
   select status,validation_streak as "validationStreak",reversion_count as "reversionCount"
   from preventive_successor_validation_state where singleton_key=1
  `;return e||null}catch{return null}}async function c(){let a=e(),[c,l,u,d]=await Promise.all([r(),i(),n(),s()]),f=o({championSource:String(c?.source||``),previousStatus:String(d?.status||`IDLE`),previousStreak:Number(d?.validationStreak||0),baselineCalibrationError:Number(l?.promotedCalibrationError||c?.calibrationError||0),baselineBrierScore:Number(l?.promotedBrierScore||c?.brierScore||0),currentCalibrationError:Number(u?.calibrationError||0),currentBrierScore:Number(u?.brierScore||0),sampleSize:Number(u?.sampleSize||0)}),p=!1;a&&f.revert&&(await a`
   update preventive_champion_baseline_state
   set source='REVERTED_SUCCESSION_CHAMPION',promoted_at=null,
    rationale=${a.json(f.rationale)},updated_at=now()
   where singleton_key=1 and source='SUCCESSION_CHAMPION'
  `,await a`
   update preventive_champion_baseline_health_state
   set status='RETIRE',retired=true,last_reason='V91 reverted succession champion after post-handoff degradation.',updated_at=now()
   where singleton_key=1
  `,await a`
   update preventive_baseline_succession_state
   set status='BUILDING',last_reason='V91 reopened succession after failed post-handoff validation.',updated_at=now()
   where singleton_key=1
  `,p=!0);let m=Number(d?.reversionCount||0)+(p?1:0),h=p?`REVERTED`:f.status;return a&&(await a`
   insert into preventive_successor_validation_state(
    singleton_key,status,validation_streak,degradation_score,reverted,reversion_count,last_reason,updated_at
   ) values(
    1,${h},${f.validationStreak},${f.degradationScore},
    ${p},${m},${f.rationale.join(` `)},now()
   )
   on conflict(singleton_key) do update set
    status=excluded.status,validation_streak=excluded.validation_streak,degradation_score=excluded.degradation_score,
    reverted=excluded.reverted,reversion_count=excluded.reversion_count,last_reason=excluded.last_reason,updated_at=now()
  `,await a`
   insert into preventive_successor_validation_snapshots(
    model_version,status,validation_streak,degradation_score,reverted,
    baseline_calibration_error,baseline_brier_score,current_calibration_error,current_brier_score,rationale
   ) values(
    ${t.modelVersion},${h},${f.validationStreak},${f.degradationScore},${p},
    ${Number(l?.promotedCalibrationError||c?.calibrationError||0)},
    ${Number(l?.promotedBrierScore||c?.brierScore||0)},
    ${Number(u?.calibrationError||0)},${Number(u?.brierScore||0)},
    ${a.json(f.rationale)}
   )
  `),{configured:!!a,...f,status:h,reverted:p,reversionCount:m}}async function l(){let t=e();if(!t)return{status:`IDLE`,validationStreak:0,degradationScore:0,reverted:!1,reversionCount:0,rationale:[],recent:[]};try{let[e]=await t`
   select status,validation_streak as "validationStreak",degradation_score::float as "degradationScore",
    reverted,reversion_count as "reversionCount",last_reason as "lastReason",updated_at as "updatedAt"
   from preventive_successor_validation_state where singleton_key=1
  `,n=await t`
   select id,status,validation_streak as "validationStreak",degradation_score::float as "degradationScore",
    reverted,generated_at as "generatedAt"
   from preventive_successor_validation_snapshots order by generated_at desc limit 20
  `;return{...e,rationale:e?.lastReason?[String(e.lastReason)]:[],recent:n}}catch{return{status:`IDLE`,validationStreak:0,degradationScore:0,reverted:!1,reversionCount:0,rationale:[],recent:[]}}}export{l as n,c as r,o as t};