import {evaluateCertificationResults,type ProviderCertification} from '@/lib/providerCertification';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});
 const base:Omit<ProviderCertification,'providerId'|'providerName'|'capability'|'status'>={
  priority:100,latencyMs:120,httpStatus:200,rowCount:20,normalizedCount:20,payloadAgeMin:2,
  freshnessScore:1,qualityScore:.95,qualityGrade:'TRUSTED',authConfigured:true,maxAgeMin:20,reasons:['ok']
 };
 const good:ProviderCertification={...base,providerId:'odds-good',providerName:'Odds Good',capability:'ODDS',status:'CERTIFIED'};
 const failed:ProviderCertification={...base,providerId:'odds-bad',providerName:'Odds Bad',capability:'ODDS',status:'FAILED',qualityScore:0,qualityGrade:'REJECT',reasons:['bad']};
 const optional:ProviderCertification={...base,providerId:'results-good',providerName:'Results Good',capability:'RESULTS',status:'CERTIFIED'};
 const ready=evaluateCertificationResults([good,optional]);
 const blocked=evaluateCertificationResults([failed,optional]);
 return Response.json({
  ok:ready.launchReady===true&&blocked.launchReady===false&&ready.coverage.find(x=>x.capability==='ODDS')?.status==='READY',
  ready,blocked
 });
}
