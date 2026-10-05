import {scorePredictiveRisk} from '@/lib/predictiveIncidentRisk';

export const dynamic='force-dynamic';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const profile:any={
  cause:'AUTOMATION',sampleSize:8,actionCount:5,watchCount:2,recurrenceScore:.82,trendScore:.80,
  cofailureComponents:['injury-feed','decision-cron'],recommendedRunbook:['Inspect automation dependencies.','Replay after upstream recovery.'],
  firstSeenAt:null,lastSeenAt:null
 };
 const risk=scorePredictiveRisk(profile,[
  {id:'automation-health',state:'DEGRADED',reason:'one automation job is stale'},
  {id:'automation-freshness',state:'DEGRADED',reason:'automation freshness is outside target'}
 ] as any);
 return Response.json({
  ok:risk.cause==='AUTOMATION'&&risk.riskScore>=.70&&(risk.riskLevel==='HIGH'||risk.riskLevel==='CRITICAL'),
  schemaVersion:'v77-predictive-incident-risk-test-1',
  risk
 });
}
