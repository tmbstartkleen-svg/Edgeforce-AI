#!/usr/bin/env node
/**
 * One-request authenticated sportsbook source probe. Explicit opt-in only.
 * No persisted source JSON, player names, raw odds, credentials, or D1 writes.
 * Performs at most ONE provider request; does not follow HTTP redirects.
 */
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const args=process.argv.slice(2);
if(args.length!==1||args[0]!=='--ack-provider-charge'){
 console.error('Usage: THE_ODDS_API_KEY=<configured locally> npm run odds:probe-live -- --ack-provider-charge');
 console.error('One API request may consume provider credits. No D1 writes are performed.');
 process.exitCode=2;
}else if(!process.env.THE_ODDS_API_KEY){
 console.error('THE_ODDS_API_KEY_NOT_CONFIGURED_LOCALLY');
 process.exitCode=2;
}else{
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const url=new URL('https://api.the-odds-api.com/v4/sports/upcoming/odds/');
  url.searchParams.set('apiKey',process.env.THE_ODDS_API_KEY);
  url.searchParams.set('regions','us');
  url.searchParams.set('bookmakers','draftkings');
  url.searchParams.set('markets','h2h');
  url.searchParams.set('oddsFormat','american');
  url.searchParams.set('dateFormat','iso');
  const response=await fetch(url,{headers:{Accept:'application/json'},signal:controller.signal,redirect:'error',cache:'no-store'});
  const quotaHeader=key=>{
   const value=response.headers.get(key);
   return value!==null&&/^\d+$/.test(value)?Number(value):null;
  };
  const quota={remaining:quotaHeader('x-requests-remaining'),used:quotaHeader('x-requests-used'),last:quotaHeader('x-requests-last')};
  // Never log raw upstream error bodies: they may echo query-string credentials.
  if(!response.ok){
   console.log(JSON.stringify({mode:'AUTHENTICATED_LIVE_SOURCE_PROBE',certified:false,
    httpStatus:response.status,upstreamResponded:true,quota,reason:'PROVIDER_RESPONSE_NOT_SUCCESSFUL'},null,2));
   process.exitCode=3;
  }else{
   const contentLength=Number(response.headers.get('content-length'));
   if(Number.isFinite(contentLength)&&contentLength>1024*1024)throw Error('PROVIDER_RESPONSE_TOO_LARGE');
   const raw=await response.text();
   if(Buffer.byteLength(raw,'utf8')>1024*1024)throw Error('PROVIDER_RESPONSE_TOO_LARGE');
   const payload=JSON.parse(raw);
   const transpile=async file=>ts.transpileModule(await readFile(new URL(file,import.meta.url),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
   const uri=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
   const mapper=uri(await transpile('../src/lib/the-odds-api-d1-preparation.ts'));
   const moduleCode=(await transpile('../src/lib/odds-ingestion-preflight.ts'))
    .replace("from './the-odds-api-d1-preparation'","from "+JSON.stringify(mapper));
   const {assessOddsIngestionPreflight}=await import(uri(moduleCode));
   const report=assessOddsIngestionPreflight(payload,Date.now());
   // Drop sensitive source payloads entirely; report only aggregate quality.
   console.log(JSON.stringify({mode:'AUTHENTICATED_LIVE_SOURCE_PROBE',certified:false,
    httpStatus:response.status,upstreamResponded:true,quota,
    provider:'The Odds API',targetBookmaker:report.targetBookmaker,
    targetQuoteCount:report.targetQuoteCount,distinctTargetOutcomes:report.distinctTargetOutcomes,
    duplicateTargetIdentities:report.duplicateTargetIdentities,sports:report.sports,
    leagues:report.leagues,unmappedMarketTypes:report.unmappedMarketTypes,
    rejected:report.rejected,eventAudit:report.eventAudit,sampleTruncated:report.sampleTruncated,
    reason:report.targetQuoteCount?'READ_ONLY_SOURCE_EVIDENCE':'NO_VALID_DRAFTKINGS_QUOTES',
    warning:'Authenticated provider response observed; no D1 persistence, independent provider verification, player props, entitlement certification, or complete catalog.'},null,2));
   if(!report.targetQuoteCount)process.exitCode=3;
  }
 }catch{
  // Do not print exception objects containing possible provider URLs or keys.
  console.error('LIVE_SOURCE_PROBE_FAILED');
  process.exitCode=3;
 }finally{clearTimeout(timeout)}
}
