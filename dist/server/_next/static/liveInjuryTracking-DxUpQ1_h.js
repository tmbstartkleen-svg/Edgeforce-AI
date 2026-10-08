import{t as e}from"./db-9LtqYd6N.js";import{t}from"./context-dSCfyRbn.js";var n=e=>e&&typeof e==`object`&&!Array.isArray(e)?e:{},r=e=>{if(Array.isArray(e))return e;let t=n(e);for(let e of[`data`,`results`,`events`,`rows`,`items`])if(Array.isArray(t[e]))return t[e];return[]};async function i(){let n=await t(!0),i=e();if(n.ok&&n.data!==void 0&&i){let e=new Date,t=Math.max(5,Number(process.env.INJURY_SNAPSHOT_TTL_MIN)||30),a=new Date(e.getTime()+t*6e4);await i`
   insert into injury_context_snapshots(provider_id,quality_score,payload,row_count,observed_at,expires_at)
   values(
    ${n.providerId||null},${n.quality?.qualityScore??null},${i.json(n.data)},
    ${r(n.data).length},${e.toISOString()},${a.toISOString()}
   )
  `}return{...n,snapshotRows:n.data===void 0?0:r(n.data).length,refreshedAt:new Date().toISOString()}}async function a(){let n=await t(!1);if(n.ok)return n;let i=e();if(!i)return n;let a=(await i`
  select provider_id as "providerId",quality_score::float as "qualityScore",payload,observed_at as "observedAt"
  from injury_context_snapshots
  where expires_at>now()
  order by observed_at desc
  limit 1
 `)[0];return a?{ok:!0,capability:`INJURIES`,providerId:String(a.providerId||`stored-injury-snapshot`),providerName:`Edgeforce Injury Snapshot`,data:a.payload,quality:{ok:!0,grade:`CAUTION`,qualityScore:Number(a.qualityScore||.65),rowCount:r(a.payload).length,reasons:[`live injury provider unavailable; using fresh persisted snapshot`]},attempts:n.attempts,error:n.error,degraded:!0}:n}export{i as n,a as t};