import {db} from './db';
import {configuredProviders} from './providers/config';
import {fetchProviderJson} from './providers/http';
import {inspectProviderPayload} from './providers/payloadQuality';
import {normalizeOddsPayload} from './providers/normalizeOdds';
import type {ProviderCapability} from './providerRegistry';
import type {ProviderConfig} from './providers/types';
import {RELEASE} from './releaseManifest';

export type CertificationStatus='CERTIFIED'|'CAUTION'|'FAILED';

export type ProviderCertification={
 providerId:string;
 providerName:string;
 capability:ProviderCapability;
 status:CertificationStatus;
 priority:number;
 latencyMs:number;
 httpStatus?:number;
 rowCount:number;
 normalizedCount?:number;
 payloadAgeMin?:number;
 freshnessScore:number;
 qualityScore:number;
 qualityGrade:string;
 authConfigured:boolean;
 maxAgeMin:number;
 reasons:string[];
 error?:string;
};

export type CapabilityCoverage={
 capability:ProviderCapability;
 required:boolean;
 configured:number;
 certified:number;
 caution:number;
 failed:number;
 score:number;
 status:'READY'|'PARTIAL'|'MISSING'|'FAILED';
};

const capabilities:ProviderCapability[]=['ODDS','WEATHER','INJURIES','STATS','RESULTS','PREDICTION_MARKETS'];
const requiredCapability=(capability:ProviderCapability)=>capability==='ODDS';
const clamp=(n:number)=>Math.max(0,Math.min(1,n));

function capabilityCoverage(results:ProviderCertification[]):CapabilityCoverage[]{
 return capabilities.map(capability=>{
  const rows=results.filter(x=>x.capability===capability);
  const certified=rows.filter(x=>x.status==='CERTIFIED').length;
  const caution=rows.filter(x=>x.status==='CAUTION').length;
  const failed=rows.filter(x=>x.status==='FAILED').length;
  const configured=rows.length;
  const score=configured?clamp((certified+caution*.55)/configured):0;
  const status:CapabilityCoverage['status']=
   !configured?'MISSING':
   certified>0?'READY':
   caution>0?'PARTIAL':'FAILED';
  return {capability,required:requiredCapability(capability),configured,certified,caution,failed,score,status};
 });
}

export async function certifyProvider(config:ProviderConfig):Promise<ProviderCertification>{
 const raw=await fetchProviderJson(config);
 if(!raw.ok){
  return {
   providerId:config.id,providerName:config.name,capability:config.capability,status:'FAILED',
   priority:config.priority,latencyMs:raw.latencyMs,httpStatus:raw.status,rowCount:0,
   freshnessScore:0,qualityScore:0,qualityGrade:'REJECT',authConfigured:Boolean(config.apiKey),
   maxAgeMin:config.maxAgeMin,reasons:[raw.error||'Provider request failed'],error:raw.error
  };
 }

 const quality=inspectProviderPayload(raw.data,config.capability,config.maxAgeMin);
 let normalizedCount: number|undefined;
 const reasons=[...quality.reasons];
 let status:CertificationStatus=quality.ok?'CERTIFIED':'FAILED';

 if(config.capability==='ODDS'){
  const normalized=normalizeOddsPayload(raw.data);
  normalizedCount=normalized.markets.length;
  if(normalizedCount===0){
   status='FAILED';
   reasons.push('Odds payload produced zero normalized markets');
  }else if(normalized.warnings.length){
   reasons.push(...normalized.warnings.slice(0,5));
  }
 }

 if(status!=='FAILED'&&(quality.grade==='CAUTION'||quality.qualityScore<.68)){
  status='CAUTION';
 }
 if(status==='CERTIFIED'&&!config.apiKey){
  reasons.push('No provider API key configured; accepted because endpoint responded successfully');
 }

 return {
  providerId:config.id,providerName:config.name,capability:config.capability,status,
  priority:config.priority,latencyMs:raw.latencyMs,httpStatus:raw.status,rowCount:quality.rowCount,
  normalizedCount,payloadAgeMin:quality.payloadAgeMin,freshnessScore:quality.freshnessScore,
  qualityScore:quality.qualityScore,qualityGrade:quality.grade,authConfigured:Boolean(config.apiKey),
  maxAgeMin:config.maxAgeMin,reasons,error:status==='FAILED'?reasons.join('; '):undefined
 };
}

export function evaluateCertificationResults(results:ProviderCertification[]){
 const coverage=capabilityCoverage(results);
 const blockers:string[]=[];
 const warnings:string[]=[];

 for(const row of coverage){
  if(row.required&&row.status!=='READY'){
   blockers.push(`${row.capability}: no certified provider available`);
  }else if(!row.required&&row.status==='MISSING'){
   warnings.push(`${row.capability}: no provider configured`);
  }else if(!row.required&&row.status!=='READY'){
   warnings.push(`${row.capability}: configured but not fully certified`);
  }
 }

 const configuredCount=results.length;
 const certifiedCount=results.filter(x=>x.status==='CERTIFIED').length;
 const cautionCount=results.filter(x=>x.status==='CAUTION').length;
 const failedCount=results.filter(x=>x.status==='FAILED').length;
 const weighted=coverage.reduce((sum,row)=>sum+(row.required?row.score*2:row.score),0);
 const weightTotal=coverage.reduce((sum,row)=>sum+(row.required?2:1),0);
 const coverageScore=weightTotal?weighted/weightTotal:0;
 const launchReady=blockers.length===0;
 return {configuredCount,certifiedCount,cautionCount,failedCount,coverageScore,launchReady,blockers,warnings,coverage};
}

export async function certifyConfiguredProviders(){
 const providers=configuredProviders();
 const startedAt=new Date().toISOString();
 const results:ProviderCertification[]=[];
 for(const provider of providers){
  results.push(await certifyProvider(provider));
 }

 const evaluation=evaluateCertificationResults(results);
 const {configuredCount,certifiedCount,cautionCount,failedCount,coverageScore,launchReady,blockers,warnings,coverage}=evaluation;

 const report={
  ok:true,
  build:RELEASE.build,
  version:RELEASE.appVersion,
  modelVersion:RELEASE.modelVersion,
  startedAt,
  completedAt:new Date().toISOString(),
  configuredCount,certifiedCount,cautionCount,failedCount,
  coverageScore,launchReady,blockers,warnings,coverage,providers:results
 };

 const sql=db();
 if(sql){
  try{
   const [run]=await sql`
    insert into provider_certification_runs(
     release_version,model_version,status,configured_count,certified_count,caution_count,
     failed_count,coverage_score,launch_ready,blockers,warnings,completed_at
    ) values(
     ${RELEASE.appVersion},${RELEASE.modelVersion},'completed',${configuredCount},${certifiedCount},
     ${cautionCount},${failedCount},${coverageScore},${launchReady},
     ${sql.json(blockers)},${sql.json(warnings)},now()
    ) returning id
   `;
   for(const row of results){
    await sql`
     insert into provider_certifications(
      run_id,provider_id,provider_name,capability,status,priority,latency_ms,http_status,row_count,
      normalized_count,payload_age_minutes,freshness_score,quality_score,quality_grade,
      auth_configured,max_age_minutes,error_text,reasons
     ) values(
      ${run.id},${row.providerId},${row.providerName},${row.capability},${row.status},${row.priority},
      ${row.latencyMs},${row.httpStatus??null},${row.rowCount},${row.normalizedCount??null},
      ${row.payloadAgeMin??null},${row.freshnessScore},${row.qualityScore},${row.qualityGrade},
      ${row.authConfigured},${row.maxAgeMin},${row.error??null},${sql.json(row.reasons)}
     )
    `;
   }
  }catch{
   // Certification must remain usable even if persistence is unavailable.
  }
 }
 return report;
}

export async function latestProviderCertification(){
 const sql=db();
 if(!sql)return null;
 try{
  const [run]=await sql`
   select id,release_version as "releaseVersion",model_version as "modelVersion",status,
    configured_count as "configuredCount",certified_count as "certifiedCount",
    caution_count as "cautionCount",failed_count as "failedCount",
    coverage_score::float as "coverageScore",launch_ready as "launchReady",
    blockers,warnings,started_at as "startedAt",completed_at as "completedAt"
   from provider_certification_runs order by started_at desc limit 1
  `;
  if(!run)return null;
  const providers=await sql`
   select provider_id as "providerId",provider_name as "providerName",capability,status,priority,
    latency_ms::float as "latencyMs",http_status as "httpStatus",row_count as "rowCount",
    normalized_count as "normalizedCount",payload_age_minutes::float as "payloadAgeMin",
    freshness_score::float as "freshnessScore",quality_score::float as "qualityScore",
    quality_grade as "qualityGrade",auth_configured as "authConfigured",
    max_age_minutes as "maxAgeMin",error_text as error,reasons,checked_at as "checkedAt"
   from provider_certifications where run_id=${run.id} order by capability,priority desc
  `;
  return {...run,providers};
 }catch{
  return null;
 }
}

export function summarizeCertification(results:ProviderCertification[]){
 return {coverage:capabilityCoverage(results)};
}
