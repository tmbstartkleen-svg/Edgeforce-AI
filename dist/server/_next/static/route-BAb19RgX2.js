import{t as e}from"./db-9LtqYd6N.js";import"./config-DeCpBpO7.js";import"./sportRegistry-DhJZkKuv.js";import"./healthStore-CIt76q0M.js";import{t}from"./releaseManifest-bHjF1npa.js";import{t as n}from"./readiness-1JiJmfZR.js";var r=`force-dynamic`;function i(e){let t=e.headers.get(`authorization`),n=[process.env.INGEST_SECRET,process.env.CRON_SECRET].filter(Boolean);return!n.length||n.some(e=>t===`Bearer ${e}`)}async function a(r){if(!i(r))return Response.json({ok:!1,error:`unauthorized`},{status:401});let a=await r.json().catch(()=>({})),o=await n(),s=e();if(!s)return Response.json({ok:!0,mode:`dry-run`,version:t.appVersion,readiness:o});let[c]=await s`
  insert into release_attestations(
   version,commit_sha,environment,migration_version,build_passed,smoke_passed,load_passed,readiness_passed,metadata
  ) values(
   ${t.appVersion},${process.env.VERCEL_GIT_COMMIT_SHA||a.commitSha||null},
   ${process.env.VERCEL_ENV||a.environment||`unknown`},${t.migrationVersion},
   ${a.buildPassed===!0},${a.smokePassed===!0},${a.loadPassed===!0},
   ${o.ready},${s.json({source:a.source||`release-workflow`,deploymentUrl:process.env.VERCEL_URL||a.deploymentUrl||null,productionReady:o.productionReady})}
  )
  returning id,created_at as "createdAt"
 `;return Response.json({ok:!0,mode:`database`,id:Number(c.id),createdAt:c.createdAt,version:t.appVersion,readiness:o})}export{a as POST,r as dynamic};