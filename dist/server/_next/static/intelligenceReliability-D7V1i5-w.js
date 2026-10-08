import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";import{n}from"./unifiedIntelligence-DGsP4XNR.js";var r=e=>e===`FAILED`||e===`STALE`,i=e=>e===`DEGRADED`||e===`UNAVAILABLE`,a=(e,t=0,n=1)=>Math.max(t,Math.min(n,e));function o(e){return e===`HEALTHY`?1:e===`DEGRADED`?.72:e===`WARMING`?.58:e===`UNAVAILABLE`?.35:e===`STALE`?.18:0}function s(e,t){let n=e?.circuitState??`CLOSED`,a=e?.consecutiveFailures??0,o=e?.consecutiveHealthy??0,s=t.state===`HEALTHY`,c=r(t.state)||t.required&&t.state===`UNAVAILABLE`,l=i(t.state)&&!c;if(n===`OPEN`)return s?{circuitState:`HALF_OPEN`,consecutiveFailures:0,consecutiveHealthy:1,transition:!0,reason:`${t.label} produced one healthy recovery check; entering half-open confirmation`}:{circuitState:`OPEN`,consecutiveFailures:a+1,consecutiveHealthy:0,transition:!1,reason:`${t.label} remains ${t.state.toLowerCase()}; circuit stays open`};if(n===`HALF_OPEN`)return s&&o>=1?{circuitState:`CLOSED`,consecutiveFailures:0,consecutiveHealthy:o+1,transition:!0,reason:`${t.label} passed two consecutive recovery checks; circuit closed`}:s?{circuitState:`HALF_OPEN`,consecutiveFailures:0,consecutiveHealthy:o+1,transition:!1,reason:`${t.label} recovery confirmation is still in progress`}:c?{circuitState:`OPEN`,consecutiveFailures:a+1,consecutiveHealthy:0,transition:!0,reason:`${t.label} relapsed to ${t.state.toLowerCase()} during half-open recovery`}:{circuitState:`HALF_OPEN`,consecutiveFailures:l?a+1:a,consecutiveHealthy:0,transition:!1,reason:`${t.label} is not healthy enough to close the circuit`};if(s)return{circuitState:`CLOSED`,consecutiveFailures:0,consecutiveHealthy:o+1,transition:!1,reason:`${t.label} is healthy`};let u=a+1,d=t.required?2:3;return c&&u>=d?{circuitState:`OPEN`,consecutiveFailures:u,consecutiveHealthy:0,transition:!0,reason:`${t.label} hit ${u} consecutive hard failures and opened its circuit`}:{circuitState:`CLOSED`,consecutiveFailures:u,consecutiveHealthy:0,transition:!1,reason:c?`${t.label} hard failure ${u}/${d}; confirmation required before isolation`:l?`${t.label} is degraded but below the circuit-open threshold`:`${t.label} is warming and remains available`}}function c(e,t){let n=e.some(e=>e.required&&e.circuitState===`OPEN`),r=e.some(e=>[`injuries`,`automation`,`validation`].includes(e.componentId)&&e.circuitState===`OPEN`);return n||r||t?.state===`BLOCKED`?`PROTECTIVE`:e.some(e=>e.circuitState!==`CLOSED`)||t?.state===`DEGRADED`?`DEGRADED`:`NORMAL`}function l(e){return e.length?a(e.reduce((e,t)=>{let n=t.circuitState===`CLOSED`?1:t.circuitState===`HALF_OPEN`?.65:.2;return e+t.reliabilityScore*n},0)/e.length):.65}async function u(){let t=e();if(!t)return{mode:`DEGRADED`,score:.6,criticalOpen:!1,openComponents:[],halfOpenComponents:[],rows:[],generatedAt:new Date().toISOString()};try{let[e,n]=await Promise.all([t`
    select component_id as "componentId",label,required,circuit_state as "circuitState",observed_state as "observedState",
     consecutive_failures as "consecutiveFailures",consecutive_healthy as "consecutiveHealthy",
     reliability_score::float as "reliabilityScore",last_reason as "lastReason",opened_at as "openedAt",
     recovered_at as "recoveredAt",last_transition_at as "lastTransitionAt",updated_at as "updatedAt"
    from intelligence_reliability_state
    order by required desc,component_id
   `,t`select system_mode as "systemMode" from intelligence_reliability_runs order by started_at desc limit 1`]),r=e,i=r.filter(e=>e.circuitState===`OPEN`).map(e=>e.componentId),a=r.filter(e=>e.circuitState===`HALF_OPEN`).map(e=>e.componentId),o=c(r),s=String(n[0]?.systemMode||``);return{mode:s===`PROTECTIVE`||o===`PROTECTIVE`?`PROTECTIVE`:s===`DEGRADED`||o===`DEGRADED`?`DEGRADED`:`NORMAL`,score:l(r),criticalOpen:r.some(e=>e.required&&e.circuitState===`OPEN`),openComponents:i,halfOpenComponents:a,rows:r,generatedAt:new Date().toISOString()}}catch{return{mode:`DEGRADED`,score:.55,criticalOpen:!1,openComponents:[],halfOpenComponents:[],rows:[],generatedAt:new Date().toISOString()}}}async function d(t,n){let r=e();r&&(n.circuitState===`OPEN`?(await r`
   select id from runtime_incidents
   where resolved_at is null and event_type='INTELLIGENCE_CIRCUIT_OPEN'
    and metadata->>'componentId'=${t.id}
   limit 1
  `).length||await r`
    insert into runtime_incidents(severity,event_type,message,metadata)
    values(
     ${t.required?`ACTION`:`WATCH`},'INTELLIGENCE_CIRCUIT_OPEN',
     ${n.reason},${r.json({componentId:t.id,label:t.label,required:t.required,observedState:t.state})}
    )
   `:n.circuitState===`CLOSED`&&await r`
   update runtime_incidents set resolved_at=now(),
    metadata=coalesce(metadata,'{}'::jsonb)||${r.json({autoRecovered:!0,recoveredAt:new Date().toISOString()})}::jsonb
   where resolved_at is null and event_type='INTELLIGENCE_CIRCUIT_OPEN'
    and metadata->>'componentId'=${t.id}
  `)}async function f(r){let i=e(),a=r??await n();if(!i)return{configured:!1,mode:a.state===`BLOCKED`?`PROTECTIVE`:`DEGRADED`,score:.55,opened:0,recovered:0,rows:[]};let l=await i`
  select component_id as "componentId",circuit_state as "circuitState",
   consecutive_failures as "consecutiveFailures",consecutive_healthy as "consecutiveHealthy"
  from intelligence_reliability_state
 `,f=new Map;for(let e of l)f.set(String(e.componentId),{circuitState:String(e.circuitState),consecutiveFailures:Number(e.consecutiveFailures||0),consecutiveHealthy:Number(e.consecutiveHealthy||0)});let p=0,m=0,h=new Date().toISOString();for(let e of a.components){let t=f.get(e.id),n=s(t,e);n.transition&&n.circuitState===`OPEN`&&p++,n.transition&&n.circuitState===`CLOSED`&&m++;let r=o(e.state),a=n.circuitState===`OPEN`?t?.circuitState===`OPEN`?null:h:null,c=n.transition&&n.circuitState===`CLOSED`?h:null;await i`
   insert into intelligence_reliability_state(
    component_id,label,required,circuit_state,observed_state,consecutive_failures,consecutive_healthy,
    reliability_score,last_reason,opened_at,recovered_at,last_transition_at,updated_at,metadata
   ) values(
    ${e.id},${e.label},${e.required},${n.circuitState},${e.state},
    ${n.consecutiveFailures},${n.consecutiveHealthy},${r},${n.reason},
    ${a},${c},${n.transition?h:null},now(),${i.json({rows:e.rows,ageMinutes:e.ageMinutes,detail:e.detail})}
   )
   on conflict(component_id) do update set
    label=excluded.label,required=excluded.required,circuit_state=excluded.circuit_state,observed_state=excluded.observed_state,
    consecutive_failures=excluded.consecutive_failures,consecutive_healthy=excluded.consecutive_healthy,
    reliability_score=excluded.reliability_score,last_reason=excluded.last_reason,
    opened_at=case when excluded.circuit_state='OPEN' then coalesce(intelligence_reliability_state.opened_at,excluded.opened_at) else null end,
    recovered_at=coalesce(excluded.recovered_at,intelligence_reliability_state.recovered_at),
    last_transition_at=coalesce(excluded.last_transition_at,intelligence_reliability_state.last_transition_at),
    updated_at=now(),metadata=excluded.metadata
  `,n.transition&&(await i`
    insert into intelligence_reliability_events(
     component_id,previous_state,next_state,observed_state,required,reliability_score,reason,metadata
    ) values(
     ${e.id},${t?.circuitState??`CLOSED`},${n.circuitState},${e.state},
     ${e.required},${r},${n.reason},${i.json({rows:e.rows,ageMinutes:e.ageMinutes})}
    )
   `,await d(e,n))}let g=await u(),_=c(g.rows,a),[v]=await i`
  insert into intelligence_reliability_runs(
   model_version,system_mode,components_checked,open_components,half_open_components,
   opened_this_run,recovered_this_run,reliability_score,completed_at,metadata
  ) values(
   ${t.modelVersion},${_},${a.components.length},${g.openComponents.length},
   ${g.halfOpenComponents.length},${p},${m},${g.score},now(),
   ${i.json({certificationState:a.state,criticalCoverage:a.criticalCoverage})}
  ) returning id
 `;return{configured:!0,runId:Number(v?.id||0),mode:_,score:g.score,opened:p,recovered:m,rows:g.rows}}function p(e,t){return e.openComponents.includes(t)}function m(e,t){let n=new Set(t.openComponents),r=e=>{let t={...e};if(n.has(`schedule`)){for(let e of[`scheduleRestEdge`,`scheduleTravelEdge`,`scheduleFatigueEdge`,`scheduleDensityEdge`,`scheduleCompositeEdge`])t[e]=0;t.scheduleContextConfidence=0}if(n.has(`venue`)){for(let e of[`venueWeatherComposite`,`venueTotalEffect`,`venueHomeEdge`,`venuePaceEffect`,`venueTemperatureEffect`,`venueWindEffect`,`venuePrecipEffect`,`venueHumidityEffect`,`venueAltitudeEffect`,`venueSurfaceEffect`])t[e]=0;t.venueWeatherConfidence=0,t.venueVolatilityEffect=Math.max(t.venueVolatilityEffect||0,.35)}if(n.has(`movement`)){for(let e of[`marketProbabilityMove`,`marketRecentMove`,`marketPointMove`,`marketMoveVelocity`,`marketSteamSignal`,`marketReversalSignal`,`marketClosingLineSignal`,`marketSharpSignal`])t[e]=0;t.marketMovementConfidence=0,t.marketMovementVolatility=Math.max(t.marketMovementVolatility||0,.25)}return t},i=new Date().toISOString();return e.map(e=>{let n=t.mode===`PROTECTIVE`,a=t.score,o=e.contextQuality?{...e.contextQuality,recommendationReady:n?!1:e.contextQuality.recommendationReady}:e.contextQuality;return{...e,sportFeatures:{...r(e.sportFeatures||{}),reliabilityScore:a,reliabilityMode:t.mode===`NORMAL`?0:t.mode===`DEGRADED`?.5:1,reliabilityCriticalOpen:t.criticalOpen?1:0,reliabilityOpenCount:t.openComponents.length,reliabilityHalfOpenCount:t.halfOpenComponents.length},contextQuality:o,contextSources:[...new Set([...e.contextSources||[],`reliability-supervisor`])],contextProvenance:[...e.contextProvenance||[],{source:`reliability-supervisor`,providerId:`edgeforce-v72-reliability`,field:`reliabilityScore`,observedAt:i,confidence:a,status:t.mode===`NORMAL`?`LIVE`:`DEGRADED`,detail:{mode:t.mode,openComponents:t.openComponents,halfOpenComponents:t.halfOpenComponents}}]}})}async function h(){let t=e(),n=await u();if(!t)return{...n,recentEvents:[],latestRun:null};try{let[e,r]=await Promise.all([t`
    select id,component_id as "componentId",previous_state as "previousState",next_state as "nextState",
     observed_state as "observedState",required,reliability_score::float as "reliabilityScore",reason,created_at as "createdAt"
    from intelligence_reliability_events order by created_at desc limit 40
   `,t`
    select id,model_version as "modelVersion",system_mode as "systemMode",components_checked as "componentsChecked",
     open_components as "openComponents",half_open_components as "halfOpenComponents",opened_this_run as "openedThisRun",
     recovered_this_run as "recoveredThisRun",reliability_score::float as "reliabilityScore",started_at as "startedAt",completed_at as "completedAt"
    from intelligence_reliability_runs order by started_at desc limit 1
   `]);return{...n,recentEvents:e,latestRun:r[0]||null}}catch{return{...n,recentEvents:[],latestRun:null}}}export{p as a,s as i,u as n,f as o,h as r,m as t};