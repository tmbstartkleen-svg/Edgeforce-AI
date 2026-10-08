import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";import{n,t as r}from"./productionObservability-DJl_h4m_.js";import{r as i}from"./preventiveSupervisionCycle-DNygHAqn.js";import{r as a,t as o}from"./incidentAttribution-BxLV61CU.js";var s=(e,t=0,n=1)=>Math.max(t,Math.min(n,e)),c=(e,t=0)=>{let n=Number(e);return Number.isFinite(n)?n:t};function l(e){let t=String(e.overallState||`UNKNOWN`).toUpperCase(),n=t===`CRITICAL`?1:t===`UNKNOWN`?.25:t===`DEGRADED`?.05:0,r=e.actionIncidents>0?1:e.watchIncidents>0?.1:0,i=e.criticalChecks>0?.75:e.degradedChecks>0?.05:0;return Math.max(n,r,i)}function u(e,t,n,r,i=.99,a=1){let o=t.getTime()-n*6e4,c=e.filter(e=>new Date(e.observedAt).getTime()>=o),u=c.reduce((e,t)=>e+l(t),0),d=c.length?u/c.length:0,f=s(1-d),p=d/Math.max(1e-4,1-i),m=1-p;return{label:r,windowMinutes:n,samples:c.length,sufficient:c.length>=a,badFraction:d,availability:f,burnRate:p,budgetRemaining:m,criticalSamples:c.filter(e=>String(e.overallState).toUpperCase()===`CRITICAL`).length,degradedSamples:c.filter(e=>String(e.overallState).toUpperCase()===`DEGRADED`).length,actionSamples:c.filter(e=>e.actionIncidents>0).length}}function d(e,t,n=.99,r=new Date){let i=u(e,r,60,`1h`,n,3),a=u(e,r,1440,`24h`,n,8),o=u(e,r,10080,`7d`,n,20),s=[],c=[],l=!1;t.overall===`CRITICAL`&&(l=!0,s.push(`current production observability is CRITICAL`)),t.actionIncidents>0&&(l=!0,s.push(`${t.actionIncidents} unresolved ACTION incident(s) are active`)),i.sufficient&&i.burnRate>=8&&(l=!0,s.push(`1h SLO burn is ${i.burnRate.toFixed(1)}x`)),a.sufficient&&a.burnRate>=4&&(l=!0,s.push(`24h SLO burn is ${a.burnRate.toFixed(1)}x`)),o.sufficient&&o.budgetRemaining<=0&&(l=!0,s.push(`7d SLO error budget is exhausted`)),i.sufficient&&i.burnRate>=4&&i.burnRate<8&&c.push(`1h burn is elevated at ${i.burnRate.toFixed(1)}x`),a.sufficient&&a.burnRate>=2&&a.burnRate<4&&c.push(`24h burn is elevated at ${a.burnRate.toFixed(1)}x`),o.sufficient&&o.budgetRemaining<.25&&o.budgetRemaining>0&&c.push(`7d error budget has ${Math.max(0,o.budgetRemaining*100).toFixed(1)}% remaining`),(!i.sufficient||!a.sufficient||!o.sufficient)&&c.push(`some SLO windows are still accumulating evidence`);let d=!l&&i.sufficient&&i.burnRate<2&&t.overall!==`CRITICAL`&&t.actionIncidents===0;return{target:n,allowedBadFraction:1-n,freezeTriggered:l,recoveryEligible:d,reasons:s,warnings:c,windows:{oneHour:i,twentyFourHour:a,sevenDay:o}}}function f(e,t,n,r){let i=e?.state??`OPEN`,a=e?.recoveryStreak??0;return t?{state:`FROZEN`,recoveryStreak:0,transition:i!==`FROZEN`,reason:r||`error-budget freeze trigger is active`}:i===`FROZEN`?n?{state:`RECOVERING`,recoveryStreak:1,transition:!0,reason:`first safe recovery check passed`}:{state:`FROZEN`,recoveryStreak:0,transition:!1,reason:`freeze remains until recovery evidence is sufficient`}:i===`RECOVERING`?n?a>=2?{state:`OPEN`,recoveryStreak:a+1,transition:!0,reason:`three consecutive safe checks passed; deployment freeze cleared`}:{state:`RECOVERING`,recoveryStreak:a+1,transition:!1,reason:`recovery check ${a+1}/3 passed`}:{state:`FROZEN`,recoveryStreak:0,transition:!0,reason:`recovery evidence regressed; deployment freeze restored`}:{state:`OPEN`,recoveryStreak:0,transition:!1,reason:`SLO budget is within deployment limits`}}async function p(){let t=e();return t?(await t`
  select observed_at as "observedAt",overall_state as "overallState",health_score::float as "healthScore",
   critical_checks as "criticalChecks",degraded_checks as "degradedChecks",unknown_checks as "unknownChecks",
   action_incidents as "actionIncidents",watch_incidents as "watchIncidents"
  from operational_health_snapshots
  where observed_at>=now()-interval '7 days'
  order by observed_at asc
 `).map(e=>({observedAt:String(e.observedAt),overallState:String(e.overallState||`UNKNOWN`),healthScore:c(e.healthScore,.5),criticalChecks:c(e.criticalChecks),degradedChecks:c(e.degradedChecks),unknownChecks:c(e.unknownChecks),actionIncidents:c(e.actionIncidents),watchIncidents:c(e.watchIncidents)})):[]}async function m(){let t=e();if(!t)return null;try{let[e]=await t`
   select deployment_state as state,recovery_streak as "recoveryStreak",slo_target::float as target,
    last_reason as "lastReason",frozen_at as "frozenAt",recovered_at as "recoveredAt",updated_at as "updatedAt"
   from slo_error_budget_state where singleton_key=1
  `;return e||null}catch{return null}}async function h(){let e=Math.min(.999,Math.max(.95,c(process.env.EDGEFORCE_SLO_TARGET,.99))),[t,n,i]=await Promise.all([p(),r(),m()]),a=d(t,{overall:String(n.overall),score:c(n.score),criticalChecks:c(n.summary?.critical),actionIncidents:c(n.incidents?.action)},e,new Date),o=i?.state||`OPEN`,s=a.freezeTriggered?`FROZEN`:o,l=c(i?.recoveryStreak),u=s===`OPEN`&&!a.freezeTriggered;return{target:e,allowedBadFraction:a.allowedBadFraction,state:s,deploymentAllowed:u,freezeTriggered:a.freezeTriggered,recoveryEligible:a.recoveryEligible,recoveryStreak:l,reasons:a.reasons,warnings:a.warnings,current:{overall:String(n.overall),score:c(n.score),criticalChecks:c(n.summary?.critical),actionIncidents:c(n.incidents?.action)},windows:a.windows,generatedAt:new Date().toISOString()}}async function g(t){let n=e();n&&(t.state===`FROZEN`?(await n`
   select id from runtime_incidents
   where resolved_at is null and event_type='SLO_ERROR_BUDGET_FROZEN'
   limit 1
  `).length||await n`
    insert into runtime_incidents(severity,event_type,message,metadata)
    values('INFO','SLO_ERROR_BUDGET_FROZEN',${t.reason},${n.json({state:t.state,recoveryStreak:t.recoveryStreak})})
   `:t.state===`OPEN`&&await n`
   update runtime_incidents set resolved_at=now(),
    metadata=coalesce(metadata,'{}'::jsonb)||${n.json({autoRecovered:!0,recoveredAt:new Date().toISOString()})}::jsonb
   where resolved_at is null and event_type='SLO_ERROR_BUDGET_FROZEN'
  `)}async function _(){let s=e(),l=await r();if(await n(l).catch(()=>({persisted:!1})),await a({attribution:o(l),observability:l}).catch(()=>({persisted:!1})),await i({observability:l}).catch(()=>({configured:!1,status:`FAILED`})),!s)return{configured:!1,...await h(),transition:!1};let u=Math.min(.999,Math.max(.95,c(process.env.EDGEFORCE_SLO_TARGET,.99))),_=d(await p(),{overall:String(l.overall),score:c(l.score),criticalChecks:c(l.summary?.critical),actionIncidents:c(l.incidents?.action)},u,new Date),v=await m(),y=v?{state:String(v.state),recoveryStreak:c(v.recoveryStreak)}:void 0,b=_.reasons.join(`; `)||_.warnings[0]||`SLO budget is within deployment limits`,x=f(y,_.freezeTriggered,_.recoveryEligible,b),S=new Date().toISOString();return await s`
  insert into slo_error_budget_state(
   singleton_key,deployment_state,recovery_streak,slo_target,last_reason,frozen_at,recovered_at,last_transition_at,updated_at,metadata
  ) values(
   1,${x.state},${x.recoveryStreak},${u},${x.reason},
   ${x.state===`FROZEN`?S:null},${x.state===`OPEN`&&x.transition?S:null},${x.transition?S:null},now(),
   ${s.json({freezeTriggered:_.freezeTriggered,recoveryEligible:_.recoveryEligible,warnings:_.warnings})}
  )
  on conflict(singleton_key) do update set
   deployment_state=excluded.deployment_state,recovery_streak=excluded.recovery_streak,slo_target=excluded.slo_target,
   last_reason=excluded.last_reason,
   frozen_at=case when excluded.deployment_state='FROZEN' then coalesce(slo_error_budget_state.frozen_at,excluded.frozen_at) else null end,
   recovered_at=coalesce(excluded.recovered_at,slo_error_budget_state.recovered_at),
   last_transition_at=coalesce(excluded.last_transition_at,slo_error_budget_state.last_transition_at),
   updated_at=now(),metadata=excluded.metadata
 `,await s`
  insert into slo_error_budget_snapshots(
   model_version,deployment_state,slo_target,deployment_allowed,freeze_triggered,recovery_eligible,
   current_overall,current_score,one_hour,twenty_four_hour,seven_day,reasons,metadata
  ) values(
   ${t.modelVersion},${x.state},${u},${x.state===`OPEN`&&!_.freezeTriggered},
   ${_.freezeTriggered},${_.recoveryEligible},${String(l.overall)},${c(l.score)},
   ${s.json(_.windows.oneHour)},${s.json(_.windows.twentyFourHour)},
   ${s.json(_.windows.sevenDay)},${s.json(_.reasons)},
   ${s.json({warnings:_.warnings,recoveryStreak:x.recoveryStreak})}
  )
 `,x.transition&&(await s`
   insert into slo_error_budget_events(previous_state,next_state,reason,recovery_streak,metadata)
   values(${y?.state||`OPEN`},${x.state},${x.reason},${x.recoveryStreak},${s.json({target:u,windows:_.windows})})
  `,await g(x)),{configured:!0,target:u,allowedBadFraction:1-u,state:x.state,deploymentAllowed:x.state===`OPEN`&&!_.freezeTriggered,freezeTriggered:_.freezeTriggered,recoveryEligible:_.recoveryEligible,recoveryStreak:x.recoveryStreak,transition:x.transition,reasons:_.reasons,warnings:_.warnings,current:{overall:String(l.overall),score:c(l.score),criticalChecks:c(l.summary?.critical),actionIncidents:c(l.incidents?.action)},windows:_.windows,generatedAt:new Date().toISOString()}}async function v(){let t=e(),n=await h();if(!t)return{...n,recent:[],events:[]};try{let[e,r]=await Promise.all([t`
    select id,model_version as "modelVersion",deployment_state as state,slo_target::float as target,
     deployment_allowed as "deploymentAllowed",freeze_triggered as "freezeTriggered",recovery_eligible as "recoveryEligible",
     current_overall as "currentOverall",current_score::float as "currentScore",one_hour as "oneHour",
     twenty_four_hour as "twentyFourHour",seven_day as "sevenDay",reasons,observed_at as "observedAt"
    from slo_error_budget_snapshots order by observed_at desc limit 30
   `,t`
    select id,previous_state as "previousState",next_state as "nextState",reason,recovery_streak as "recoveryStreak",created_at as "createdAt"
    from slo_error_budget_events order by created_at desc limit 30
   `]);return{...n,recent:e,events:r}}catch{return{...n,recent:[],events:[]}}}export{f as a,v as i,d as n,_ as o,u as r,h as t};