import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";var n=e=>Math.max(0,Math.min(1,e));function r(e){return e.trim().toLowerCase().replace(/[^a-z0-9]+/g,`-`).replace(/^-|-$/g,``).slice(0,120)||`unspecified-action`}function i(e){let t=new Map;for(let n of e){if(n.incidentOccurred===null)continue;let e=`${n.cause}::${n.actionKey}`,r=t.get(e)||[];r.push(n),t.set(e,r)}let r=[];for(let[e,i]of t){let[t,a]=e.split(`::`),o=i.filter(e=>e.incidentOccurred===!1).length,s=i.filter(e=>e.incidentOccurred===!0).length,c=i.length,l=o/Math.max(1,c),u=n(c/8),d=n(.5+(l-.5)*u);r.push({cause:t,actionKey:a,actionText:i.at(-1)?.actionText||a,sampleSize:c,preventedCount:o,incidentCount:s,effectivenessScore:d,confidence:u})}return r.sort((e,t)=>t.effectivenessScore-e.effectivenessScore||t.sampleSize-e.sampleSize)}async function a(){let t=e();return t?(await t`
  select id,cause,action_key as "actionKey",action_text as "actionText",source_risk_score::float as "sourceRiskScore",
   source_risk_level as "sourceRiskLevel",applied_at as "appliedAt",evaluated_at as "evaluatedAt",
   incident_occurred as "incidentOccurred",outcome
  from preventive_action_events
  where evaluated_at is null and applied_at<=now()-interval '24 hours'
  order by applied_at asc
 `).map(e=>({id:Number(e.id),cause:String(e.cause),actionKey:String(e.actionKey),actionText:String(e.actionText),sourceRiskScore:Number(e.sourceRiskScore||0),sourceRiskLevel:String(e.sourceRiskLevel||`LOW`),appliedAt:new Date(e.appliedAt).toISOString(),evaluatedAt:e.evaluatedAt?new Date(e.evaluatedAt).toISOString():null,incidentOccurred:e.incidentOccurred===null?null:!!e.incidentOccurred,outcome:e.outcome?String(e.outcome):null})):[]}async function o(){let t=e();return t?(await t`
  select id,cause,action_key as "actionKey",action_text as "actionText",source_risk_score::float as "sourceRiskScore",
   source_risk_level as "sourceRiskLevel",applied_at as "appliedAt",evaluated_at as "evaluatedAt",
   incident_occurred as "incidentOccurred",outcome
  from preventive_action_events
  where evaluated_at is not null and applied_at>=now()-interval '90 days'
  order by applied_at asc
 `).map(e=>({id:Number(e.id),cause:String(e.cause),actionKey:String(e.actionKey),actionText:String(e.actionText),sourceRiskScore:Number(e.sourceRiskScore||0),sourceRiskLevel:String(e.sourceRiskLevel||`LOW`),appliedAt:new Date(e.appliedAt).toISOString(),evaluatedAt:e.evaluatedAt?new Date(e.evaluatedAt).toISOString():null,incidentOccurred:e.incidentOccurred===null?null:!!e.incidentOccurred,outcome:e.outcome?String(e.outcome):null})):[]}async function s(){let t=e();if(!t)return{evaluated:0};let n=await a(),r=0;for(let e of n){let n=(await t`
   select 1
   from incident_attribution_snapshots
   where primary_cause=${e.cause}
    and severity='ACTION'
    and observed_at>${e.appliedAt}
    and observed_at<=${e.appliedAt}::timestamptz+interval '24 hours'
   limit 1
  `).length>0;await t`
   update preventive_action_events
   set evaluated_at=now(),incident_occurred=${n},
    outcome=${n?`INCIDENT_OCCURRED`:`PREVENTED_OR_NO_INCIDENT`}
   where id=${e.id}
  `,r++}return{evaluated:r}}async function c(){let n=e();if(!n)return{profiles:[],persisted:!1};let r=await o(),a=i(r);for(let e of a)await n`
   insert into preventive_action_effectiveness(
    cause,action_key,sample_size,prevented_count,incident_count,effectiveness_score,confidence,updated_at
   ) values(
    ${e.cause},${e.actionKey},${e.sampleSize},${e.preventedCount},${e.incidentCount},${e.effectivenessScore},${e.confidence},now()
   )
   on conflict(cause,action_key) do update set
    sample_size=excluded.sample_size,prevented_count=excluded.prevented_count,incident_count=excluded.incident_count,
    effectiveness_score=excluded.effectiveness_score,confidence=excluded.confidence,updated_at=now()
  `;let s=a[0]||null;return await n`
  insert into preventive_action_learning_snapshots(
   model_version,evaluated_events,best_cause,best_action_key,best_effectiveness,profiles
  ) values(
   ${t.modelVersion},${r.length},${s?.cause||null},${s?.actionKey||null},
   ${s?.effectivenessScore||0},${n.json(a)}
  )
 `,{profiles:a,persisted:!0,evaluatedEvents:r.length}}async function l(t){let n=e();if(!n)return{recorded:!1,id:null};let i=r(t.actionText),a=await n`
  insert into preventive_action_events(cause,action_key,action_text,source_risk_score,source_risk_level,applied_by)
  values(${t.cause},${i},${t.actionText},${t.sourceRiskScore},${t.sourceRiskLevel},${t.appliedBy||null})
  returning id
 `;return{recorded:!0,id:Number(a[0]?.id||0),actionKey:i}}async function u(){let e=await s();return{...await c(),evaluatedNow:e.evaluated}}async function d(){let t=e();if(!t)return{generatedAt:new Date().toISOString(),profiles:[],evaluatedEvents:0,recent:[]};try{let[e,n]=await Promise.all([t`
    select cause,action_key as "actionKey",sample_size as "sampleSize",prevented_count as "preventedCount",
     incident_count as "incidentCount",effectiveness_score::float as "effectivenessScore",confidence::float as confidence,
     updated_at as "updatedAt"
    from preventive_action_effectiveness
    order by effectiveness_score desc,sample_size desc
    limit 50
   `,t`
    select id,cause,action_key as "actionKey",action_text as "actionText",source_risk_score::float as "sourceRiskScore",
     source_risk_level as "sourceRiskLevel",applied_at as "appliedAt",evaluated_at as "evaluatedAt",
     incident_occurred as "incidentOccurred",outcome
    from preventive_action_events order by applied_at desc limit 30
   `]);return{generatedAt:new Date().toISOString(),profiles:e,recent:n,evaluatedEvents:e.reduce((e,t)=>e+Number(t.sampleSize||0),0)}}catch{return{generatedAt:new Date().toISOString(),profiles:[],evaluatedEvents:0,recent:[]}}}export{u as a,l as i,d as n,r,i as t};