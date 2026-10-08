import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";function n(e,t,n={}){let r={ts:new Date().toISOString(),level:e,event:t,service:`edgeforce-ai`,version:process.env.MODEL_VERSION||`edgeforce-v16`,deployment:process.env.VERCEL_URL||null,...n},i=JSON.stringify(r);return e===`error`?console.error(i):e===`warn`?console.warn(i):console.log(i),r}var r=()=>{let e=Number(process.env.PERFORMANCE_SAMPLE_RATE||.1);return Number.isFinite(e)?Math.max(0,Math.min(1,e)):.1};async function i(t,i,a,o){if(n(a>=500?`error`:i>1500?`warn`:`info`,`http.performance`,{route:t,durationMs:i,statusCode:a,providerId:o||null}),Math.random()>r())return;let s=e();s&&await s`
  insert into performance_samples(route,duration_ms,status_code,provider_id,created_at)
  values(${t},${i},${a},${o??null},now())
 `.catch(()=>void 0)}async function a(r,i,a,o={},s){n(r===`ACTION`?`error`:r===`WATCH`?`warn`:`info`,`runtime.incident`,{severity:r,eventType:i,message:a,requestId:s||null,...o});let c=e();c&&await c`
  insert into runtime_incidents(severity,event_type,message,request_id,metadata,created_at)
  values(${r},${i},${a},${s??null},${c.json({...o,release:t.appVersion})},now())
 `.catch(()=>void 0)}async function o(n){let r=e();r&&await r`
  insert into operational_heartbeats(
   version,environment,ready,production_ready,odds_operational,required_failures,commit_sha,created_at
  ) values(
   ${t.appVersion},${n.environment},${n.ready},${n.productionReady},
   ${n.providers.oddsOperational},${r.json(n.requiredFailures)},
   ${process.env.VERCEL_GIT_COMMIT_SHA||null},now()
  )
 `.catch(()=>void 0)}export{a as n,i as r,o as t};