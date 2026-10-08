import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";import"./modelGovernance-DERBcsy-.js";import"./validationLab-CpfyTMQ0.js";import"./learnedWeights-BG8kt-l2.js";import"./modelCouncil-nbPr2v_W.js";import"./trainedSportModels-DWPIV0xx.js";import{a as n}from"./mlServiceHealth-CHTaakhh.js";import"./mlShadowRecovery-CpgsKdSZ.js";import"./externalMlTournament-BXF1Gq6f.js";import{r}from"./mlActivation-DhDhzG4t.js";async function i(i={}){let a=await n({force:!0,persist:!0}),o=await r(),s=a.deployment||{},c=o.readiness?.state||`UNHEALTHY`,l=c===`ACTIVE`||c===`READY_AWAITING_EVIDENCE`,u=o.tournament?.latestRun,d=Number(o.tournament?.summary?.champions||0),f={ok:l&&a.ok,build:`V61`,schemaVersion:`v61-ml-deployment-attestation-1`,modelVersion:t.modelVersion,deploymentStatus:c,healthOk:!!a.ok,predictionHandshakeOk:!!o.latestActivation?.predictionHandshakeOk,activationState:c,tournamentStatus:u?.status||null,championsActive:d,serviceVersion:a.serviceVersion||null,provider:s.platform||`render`,serviceId:s.serviceId||null,serviceName:s.serviceName||null,serviceUrl:s.externalUrl||null,gitCommit:s.gitCommit||null,gitBranch:s.gitBranch||null,deploymentId:i.deploymentId||null,algorithms:a.algorithms||{},details:{latencyMs:a.latencyMs,cpuCount:s.cpuCount||null,instanceId:s.instanceId||null,repoSlug:s.repoSlug||null,activationReason:o.readiness?.reason||null,tournamentRunId:u?.id||null},error:l&&a.ok?null:a.error||o.latestActivation?.error||o.readiness?.reason||`ML deployment not activation-ready`},p=e();if(p)try{await p`
    insert into ml_service_deployment_attestations(
     model_version,service_version,provider,service_id,service_name,service_url,
     git_commit,git_branch,deployment_id,deployment_status,health_ok,prediction_handshake_ok,
     activation_state,tournament_status,champions_active,algorithms,details,error_text,created_at
    ) values(
     ${f.modelVersion},${f.serviceVersion},${f.provider},${f.serviceId},
     ${f.serviceName},${f.serviceUrl},${f.gitCommit},${f.gitBranch},
     ${f.deploymentId},${f.deploymentStatus},${f.healthOk},
     ${f.predictionHandshakeOk},${f.activationState},${f.tournamentStatus},
     ${f.championsActive},${p.json(f.algorithms)},${p.json(f.details)},
     ${f.error},now()
    )
   `}catch{}return f}async function a(t=20){let n=e();if(!n)return{ok:!0,source:`none`,latest:null,rows:[]};try{let e=await n`
   select id,model_version as "modelVersion",service_version as "serviceVersion",provider,
    service_id as "serviceId",service_name as "serviceName",service_url as "serviceUrl",
    git_commit as "gitCommit",git_branch as "gitBranch",deployment_id as "deploymentId",
    deployment_status as "deploymentStatus",health_ok as "healthOk",
    prediction_handshake_ok as "predictionHandshakeOk",activation_state as "activationState",
    tournament_status as "tournamentStatus",champions_active as "championsActive",
    algorithms,details,error_text as error,created_at as "createdAt"
   from ml_service_deployment_attestations
   order by created_at desc
   limit ${Math.max(1,Math.min(100,t))}
  `;return{ok:!0,source:`database`,latest:e[0]||null,rows:e}}catch(e){return{ok:!1,source:`database`,latest:null,rows:[],error:e instanceof Error?e.message:`ML deployment attestation status failed`}}}var o=`force-dynamic`;function s(e){let t=e.headers.get(`authorization`),n=[process.env.ML_ACTIVATION_SECRET,process.env.INGEST_SECRET,process.env.CRON_SECRET,process.env.DEPLOY_BOOTSTRAP_SECRET].filter(Boolean);return!n.length||n.some(e=>t===`Bearer ${e}`)}async function c(){let e=await a();return Response.json({...e,build:`V61`,schemaVersion:`v61-ml-deployment-attestation-1`},{headers:{"Cache-Control":`no-store`}})}async function l(e){if(!s(e))return Response.json({ok:!1,error:`unauthorized`},{status:401});let t=await e.json().catch(()=>({}));try{let e=await i({deploymentId:t.deploymentId||null});return Response.json(e,{status:e.ok?200:202,headers:{"Cache-Control":`no-store`}})}catch(e){return Response.json({ok:!1,error:e instanceof Error?e.message:`ML deployment attestation failed`},{status:500,headers:{"Cache-Control":`no-store`}})}}export{c as GET,l as POST,o as dynamic};