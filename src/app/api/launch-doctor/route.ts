import {evaluateReadiness} from '@/lib/readiness';
import {configuredProviders} from '@/lib/providers/config';
import {latestProviderCertification,providerCertificationRuntimeCommit} from '@/lib/providerCertification';
import {RELEASE} from '@/lib/releaseManifest';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const url=new URL(req.url);
 const strict=url.searchParams.get('strict')==='1'||url.searchParams.get('strict')==='true';
 const deploymentCommit=providerCertificationRuntimeCommit();
 const [readiness,certification]=await Promise.all([
  evaluateReadiness({strict:strict||undefined}),
  latestProviderCertification(deploymentCommit||undefined)
 ]);
 const configured=configuredProviders();
 const configuredCapabilities=[...new Set(configured.map(x=>x.capability))];
 const pulseRow=((certification as any)?.providers||[]).find((x:any)=>
  String(x?.providerId||'')==='fanlinewire-fanduel-pulse'&&String(x?.status||'')==='CERTIFIED'
 );
 const pulseCheckedAt=pulseRow?.checkedAt?new Date(String(pulseRow.checkedAt)).getTime():0;
 const pulseCertificationAgeMs=pulseCheckedAt?Math.max(0,Date.now()-pulseCheckedAt):Number.POSITIVE_INFINITY;
 const currentPulseCertification=Boolean(
  certification&&
  certification.releaseVersion===RELEASE.appVersion&&
  certification.launchReady===true&&
  pulseRow&&
  pulseCertificationAgeMs<=2*60*1000
 );
 const onlyTransientPulseFailure=
  readiness.requiredFailures.length>0&&
  readiness.requiredFailures.every(x=>x==='oddsProvider')&&
  currentPulseCertification;
 const effectiveRequiredFailures=onlyTransientPulseFailure
  ?readiness.requiredFailures.filter(x=>x!=='oddsProvider')
  :readiness.requiredFailures;
 const blockers=[...effectiveRequiredFailures.map(x=>`readiness: ${x}`)];
 const warnings=[
  ...readiness.warnings,
  ...(onlyTransientPulseFailure
   ?[`readiness: live pulse recheck missed, but current-release FanDuel pulse certification is ${Math.round(pulseCertificationAgeMs/1000)}s old`]
   :[])
 ];

 if(!certification){
  blockers.push(deploymentCommit
   ?`provider certification has not been run for deployment ${deploymentCommit}`
   :'provider certification has not been run');
 }else{
  if(deploymentCommit&&certification.deploymentCommit!==deploymentCommit){
   blockers.push('provider certification deployment identity mismatch');
  }
  blockers.push(...((certification.blockers as string[]|undefined)||[]).map(x=>`provider: ${x}`));
  warnings.push(...((certification.warnings as string[]|undefined)||[]).map(x=>`provider: ${x}`));
  if(certification.releaseVersion!==RELEASE.appVersion){
   warnings.push(`latest provider certification is from app ${certification.releaseVersion}, current app is ${RELEASE.appVersion}`);
  }
 }

 const ready=blockers.length===0&&(readiness.ready||onlyTransientPulseFailure);
 return Response.json({
  ok:true,
  ready,
  build:RELEASE.build,
  version:RELEASE.appVersion,
  modelVersion:RELEASE.modelVersion,
  migrationVersion:RELEASE.migrationVersion,
  readiness,
  certification,
  certificationIdentity:{expectedCommit:deploymentCommit||null,matched:Boolean(!deploymentCommit||(certification&&certification.deploymentCommit===deploymentCommit))},
  pulseCertificationContinuity:{active:onlyTransientPulseFailure,current:currentPulseCertification,ageMs:Number.isFinite(pulseCertificationAgeMs)?pulseCertificationAgeMs:null},
  configuredProviders:configured.length,
  configuredCapabilities,
  blockers,
  warnings,
  recommendations:[
   ...(configured.filter(x=>x.capability==='ODDS').length>=2?[]:['Connect a second independent odds provider to enable deeper cross-book consensus.']),
   ...(configuredCapabilities.includes('RESULTS')?[]:['Connect a results provider to automate settlement and prediction feedback.']),
   ...(configuredCapabilities.includes('WEATHER')?[]:['Connect a weather provider for outdoor-sport context.']),
   ...(configuredCapabilities.includes('INJURIES')?[]:['Connect an injury provider for automated availability context.']),
   ...(configuredCapabilities.includes('PREDICTION_MARKETS')?[]:['Connect a liquid prediction-market provider for cross-market consensus.'])
  ],
  time:new Date().toISOString()
 },{status:ready?200:503,headers:{'Cache-Control':'no-store'}});
}
