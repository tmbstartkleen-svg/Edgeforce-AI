import{t as e}from"./db-9LtqYd6N.js";function t(e,t){let n=Math.max(.001,Math.min(.999,e)),r=t?1:0;return{brier:(n-r)**2,logLoss:-(r*Math.log(n)+(1-r)*Math.log(1-n)),calibrationError:Math.abs(n-r)}}async function n(t){let n=e();return n?(await n`
  insert into universal_event_resolutions(
   event_key,domain,category,status,outcome,resolution_source,resolution_rule,resolved_at,metadata,updated_at
  ) values(
   ${t.eventKey},${t.domain},${t.category},${t.status},${t.outcome??null},
   ${t.resolutionSource},${t.resolutionRule??null},${t.resolvedAt??null},
   ${n.json(t.metadata||{})},now()
  )
  on conflict(event_key) do update set
   domain=excluded.domain,
   category=excluded.category,
   status=excluded.status,
   outcome=excluded.outcome,
   resolution_source=excluded.resolution_source,
   resolution_rule=excluded.resolution_rule,
   resolved_at=excluded.resolved_at,
   metadata=excluded.metadata,
   updated_at=now()
 `,{mode:`database`,written:!0}):{mode:`memory`,written:!1}}async function r(n){let r=t(n.predictedProbability,n.outcome),i=n.marketProbability===void 0?null:t(n.marketProbability,n.outcome),a=i===null?null:i.brier-r.brier,o=e();return o&&await o`
   insert into universal_forecast_grades(
    forecast_id,event_key,domain,category,venue,model_version,predicted_probability,market_probability,
    outcome,brier,log_loss,calibration_error,market_skill,strategy_key,settled_at
   ) values(
    ${n.forecastId},${n.eventKey},${n.domain},${n.category},${n.venue??null},
    ${n.modelVersion},${n.predictedProbability},${n.marketProbability??null},
    ${n.outcome},${r.brier},${r.logLoss},${r.calibrationError},${a},${n.strategyKey||`GENERAL`},
    ${n.settledAt||new Date().toISOString()}
   )
   on conflict(forecast_id) do update set
    outcome=excluded.outcome,
    brier=excluded.brier,
    log_loss=excluded.log_loss,
    calibration_error=excluded.calibration_error,
    market_skill=excluded.market_skill,
    strategy_key=excluded.strategy_key,
    settled_at=excluded.settled_at
  `,{...r,marketSkill:a,persisted:!!o}}async function i(){let t=e();return t?{configured:!0,rows:await t`
  select domain,category,model_version,
   count(*)::int as graded,
   avg(brier)::float8 as brier,
   avg(log_loss)::float8 as log_loss,
   avg(calibration_error)::float8 as calibration_error,
   avg(market_skill)::float8 as market_skill
  from universal_forecast_grades
  group by domain,category,model_version
  order by graded desc,domain,category
  limit 250
 `,totals:(await t`select count(*)::int as graded from universal_forecast_grades`)[0]||{graded:0}}:{configured:!1,rows:[],totals:{graded:0}}}var a=`force-dynamic`;async function o(){return Response.json({ok:!0,generatedAt:new Date().toISOString(),...await i()},{headers:{"Cache-Control":`no-store`}})}async function s(e){if(process.env.INGEST_SECRET&&e.headers.get(`authorization`)!==`Bearer ${process.env.INGEST_SECRET}`)return Response.json({ok:!1,error:`unauthorized`},{status:401});let t=await e.json(),i=String(t.eventKey||``),a=String(t.domain||``).toUpperCase(),o=String(t.category||`OTHER`),s=String(t.status||`RESOLVED`).toUpperCase(),c=String(t.resolutionSource||``);if(!i||![`SPORTS`,`MARKETS`].includes(a)||!c)return Response.json({ok:!1,error:`eventKey, domain and resolutionSource are required`},{status:400});let l=typeof t.outcome==`boolean`?t.outcome:null,u=await n({eventKey:i,domain:a,category:o,status:s,outcome:l,resolutionSource:c,resolutionRule:typeof t.resolutionRule==`string`?t.resolutionRule:void 0,resolvedAt:typeof t.resolvedAt==`string`?t.resolvedAt:void 0,metadata:t.metadata&&typeof t.metadata==`object`?t.metadata:void 0}),d=Array.isArray(t.forecasts)?t.forecasts:[],f=[];if(l!==null&&s===`RESOLVED`)for(let e of d){if(!e||typeof e!=`object`)continue;let t=e,n=Number(t.predictedProbability);if(!Number.isFinite(n))continue;let s={forecastId:String(t.forecastId||``),eventKey:i,domain:a,category:o,venue:typeof t.venue==`string`?t.venue:void 0,modelVersion:String(t.modelVersion||`unknown`),strategyKey:typeof t.strategyKey==`string`?t.strategyKey:`GENERAL`,predictedProbability:n,marketProbability:Number.isFinite(Number(t.marketProbability))?Number(t.marketProbability):void 0,outcome:l};s.forecastId&&f.push({forecastId:s.forecastId,...await r(s)})}return Response.json({ok:!0,resolution:u,grades:f,graded:f.length})}export{o as GET,s as POST,a as dynamic};