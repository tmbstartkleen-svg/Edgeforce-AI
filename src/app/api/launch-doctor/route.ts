import {evaluateReadiness} from '@/lib/readiness';
import {configuredProviders} from '@/lib/providers/config';
import {latestProviderCertification} from '@/lib/providerCertification';
import {RELEASE} from '@/lib/releaseManifest';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const url=new URL(req.url);
 const strict=url.searchParams.get('strict')==='1'||url.searchParams.get('strict')==='true';
 const [readiness,certification]=await Promise.all([
  evaluateReadiness({strict:strict||undefined}),
  latestProviderCertification()
 ]);
 const configured=configuredProviders();
 const configuredCapabilities=[...new Set(configured.map(x=>x.capability))];
 const blockers=[...readiness.requiredFailures.map(x=>`readiness: ${x}`)];
 const warnings=[...readiness.warnings];

 if(!certification){
  blockers.push('provider certification has not been run');
 }else{
  blockers.push(...((certification.blockers as string[]|undefined)||[]).map(x=>`provider: ${x}`));
  warnings.push(...((certification.warnings as string[]|undefined)||[]).map(x=>`provider: ${x}`));
  if(certification.releaseVersion!==RELEASE.appVersion){
   warnings.push(`latest provider certification is from app ${certification.releaseVersion}, current app is ${RELEASE.appVersion}`);
  }
 }

 const ready=blockers.length===0&&readiness.ready;
 return Response.json({
  ok:true,
  ready,
  build:RELEASE.build,
  version:RELEASE.appVersion,
  modelVersion:RELEASE.modelVersion,
  migrationVersion:RELEASE.migrationVersion,
  readiness,
  certification,
  configuredProviders:configured.length,
  configuredCapabilities,
  blockers,
  warnings,
  recommendations:[
   ...(configuredCapabilities.includes('RESULTS')?[]:['Connect a results provider to automate settlement and prediction feedback.']),
   ...(configuredCapabilities.includes('WEATHER')?[]:['Connect a weather provider for outdoor-sport context.']),
   ...(configuredCapabilities.includes('INJURIES')?[]:['Connect an injury provider for automated availability context.']),
   ...(configuredCapabilities.includes('PREDICTION_MARKETS')?[]:['Connect a liquid prediction-market provider for cross-market consensus.'])
  ],
  time:new Date().toISOString()
 },{status:ready?200:503,headers:{'Cache-Control':'no-store'}});
}
