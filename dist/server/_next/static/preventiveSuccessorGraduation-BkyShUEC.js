import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";import{t as n}from"./preventiveChampionBaseline-CxqOD8Ok.js";import{n as r}from"./preventiveSuccessorValidation-CDmbX1sP.js";function i(e){let t=[];return e.championSource===`SUCCESSION_CHAMPION`?e.validationStatus===`CONFIRMED`&&e.validationStreak>=3?(t.push(`Post-handoff confirmation completed; succession champion may graduate into normal champion lifecycle.`),{status:`GRADUATE`,eligible:!0,rationale:t}):(t.push(`Succession champion has not yet completed post-handoff confirmation.`),{status:`WAITING`,eligible:!1,rationale:t}):{status:`IDLE`,eligible:!1,rationale:[`No probationary succession champion is active.`]}}async function a(){let t=e();if(!t)return null;try{let[e]=await t`
   select graduation_count as "graduationCount"
   from preventive_successor_graduation_state where singleton_key=1
  `;return e||null}catch{return null}}async function o(){let o=e(),[s,c,l]=await Promise.all([n(),r(),a()]),u=i({championSource:String(s?.source||``),validationStatus:String(c?.status||`IDLE`),validationStreak:Number(c?.validationStreak||0)}),d=!1;o&&u.eligible&&(await o`
   update preventive_champion_baseline_state
   set source='CONFIRMED_SUCCESSION_CHAMPION',
    rationale=${o.json(u.rationale)},updated_at=now()
   where singleton_key=1 and source='SUCCESSION_CHAMPION'
  `,await o`
   update preventive_baseline_handoff_state
   set status='CONFIRMED',promoted=true,last_reason='V92 succession champion graduated after post-handoff validation.',updated_at=now()
   where singleton_key=1
  `,await o`
   update preventive_successor_validation_state
   set status='GRADUATED',last_reason='V92 validation complete; successor moved into normal champion lifecycle.',updated_at=now()
   where singleton_key=1
  `,await o`
   update preventive_champion_baseline_health_state
   set status='ACTIVE',retired=false,last_reason='V92 confirmed succession champion entered normal health supervision.',updated_at=now()
   where singleton_key=1
  `,d=!0);let f=Number(l?.graduationCount||0)+(d?1:0),p=d?`GRADUATED`:u.status;return o&&(await o`
   insert into preventive_successor_graduation_state(
    singleton_key,status,graduated,graduation_count,validation_streak,source,last_reason,updated_at
   ) values(
    1,${p},${d},${f},${Number(c?.validationStreak||0)},
    ${String(s?.source||``)},${u.rationale.join(` `)},now()
   )
   on conflict(singleton_key) do update set
    status=excluded.status,graduated=excluded.graduated,graduation_count=excluded.graduation_count,
    validation_streak=excluded.validation_streak,source=excluded.source,last_reason=excluded.last_reason,updated_at=now()
  `,await o`
   insert into preventive_successor_graduation_snapshots(
    model_version,status,graduated,validation_streak,champion_source,rationale
   ) values(
    ${t.modelVersion},${p},${d},${Number(c?.validationStreak||0)},
    ${String(s?.source||``)},${o.json(u.rationale)}
   )
  `),{configured:!!o,...u,status:p,graduated:d,graduationCount:f}}async function s(){let t=e();if(!t)return{status:`IDLE`,graduated:!1,graduationCount:0,validationStreak:0,source:null,rationale:[],recent:[]};try{let[e]=await t`
   select status,graduated,graduation_count as "graduationCount",validation_streak as "validationStreak",
    source,last_reason as "lastReason",updated_at as "updatedAt"
   from preventive_successor_graduation_state where singleton_key=1
  `,n=await t`
   select id,status,graduated,validation_streak as "validationStreak",champion_source as "championSource",
    generated_at as "generatedAt"
   from preventive_successor_graduation_snapshots order by generated_at desc limit 20
  `;return{...e,rationale:e?.lastReason?[String(e.lastReason)]:[],recent:n}}catch{return{status:`IDLE`,graduated:!1,graduationCount:0,validationStreak:0,source:null,rationale:[],recent:[]}}}export{s as n,o as r,i as t};