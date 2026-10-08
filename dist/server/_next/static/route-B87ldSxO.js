import{t as e}from"./db-9LtqYd6N.js";import"./automationHealth-BEUnKhvu.js";import"./validationLab-CpfyTMQ0.js";import"./crossSportOptimizer-CT9Cmvuj.js";import"./unifiedIntelligence-DGsP4XNR.js";import"./intelligenceReliability-D7V1i5-w.js";import{r as t}from"./regimeConfidence-BQ3CLQ61.js";var n=`force-dynamic`;async function r(){let n=await t(),r=e();if(!r)return Response.json({ok:!0,source:`memory`,profileCount:Object.keys(n).length,profiles:Object.values(n).slice(0,100),recent:[]},{headers:{"Cache-Control":`no-store`}});try{let e=await r`
   select event_id as "eventId",market_key as "marketKey",selection_key as "selection",
    simulation_probability::float as "simulationProbability",
    feature_snapshot->>'regime' as regime,
    (feature_snapshot->>'dynamicConfidence')::float as "dynamicConfidence",
    (feature_snapshot->>'uncertainty')::float as uncertainty,
    feature_snapshot->>'confidenceLabel' as "confidenceLabel",
    created_at as "createdAt"
   from model_runs
   where feature_snapshot ? 'dynamicConfidence'
   order by created_at desc
   limit 250
  `,t={stable:0,volatile:0,dislocated:0,thin:0,unknown:0,high:0,medium:0,low:0};for(let n of e){let e=String(n.regime||`UNKNOWN`).toLowerCase();(e===`stable`||e===`volatile`||e===`dislocated`||e===`thin`||e===`unknown`)&&t[e]++;let r=String(n.confidenceLabel||`LOW`).toLowerCase();(r===`high`||r===`medium`||r===`low`)&&t[r]++}return Response.json({ok:!0,source:`database`,profileCount:Object.keys(n).length,profiles:Object.values(n).slice(0,100),counts:t,recent:e},{headers:{"Cache-Control":`no-store`}})}catch(e){return Response.json({ok:!0,source:`database`,profileCount:Object.keys(n).length,profiles:Object.values(n).slice(0,100),recent:[],error:e instanceof Error?e.message:`regime query failed`},{headers:{"Cache-Control":`no-store`}})}}export{r as GET,n as dynamic};