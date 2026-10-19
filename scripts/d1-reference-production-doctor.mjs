#!/usr/bin/env node
// Read-only remote diagnostics for reference ingestion. Never sends test records.
const base=(process.env.EDGEFORCE_API_ORIGIN||'https://edgeforce-ai.tmbstartkleen.workers.dev').replace(/\/$/,'');
const path='/api/operations/d1-pilot/reference-ingest/status';
const secret=process.env.INGEST_SECRET;
const result={target:base,endpoint:path,productionCutoverAuthorized:false};
try{
 const unauthed=await fetch(base+path,{headers:{'Cache-Control':'no-store'},signal:AbortSignal.timeout(15000)});
 result.unauthenticatedStatus=unauthed.status;
 if(unauthed.status!==401&&unauthed.status!==503)throw Error('Unexpected unauthenticated status: '+unauthed.status);
 if(!secret){result.authenticatedCheck='SKIPPED_NO_INGEST_SECRET';console.log(JSON.stringify(result,null,2));process.exit(0);}
 const response=await fetch(base+path,{headers:{Authorization:'Bearer '+secret,'Cache-Control':'no-store'},signal:AbortSignal.timeout(15000)});
 result.authenticatedStatus=response.status;
 const body=await response.json().catch(()=>null);
 if(body?.kind==='D1_REFERENCE_INGEST_STATUS'){
  result.enabled=body.enabled===true;
  result.migrationReady=body.migrationReady===true;
  result.rows=body.rows;
  result.productionCutoverAuthorized=false;
 }else result.reason=body?.reason||'INVALID_DIAGNOSTIC_RESPONSE';
 console.log(JSON.stringify(result,null,2));
 if(response.status!==200||!result.migrationReady||result.enabled)process.exitCode=1;
}catch(e){result.error=e instanceof Error?e.message:'UNKNOWN_ERROR';console.error(JSON.stringify(result,null,2));process.exitCode=1;}
