import {buildActionEffectivenessProfiles,normalizeActionKey} from '@/lib/preventiveActionLearning';

export const dynamic='force-dynamic';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const actionText='Verify provider quota and force a live refresh.';
 const key=normalizeActionKey(actionText);
 const events:any[]=[
  {id:1,cause:'MARKET_FRESHNESS',actionKey:key,actionText,sourceRiskScore:.8,sourceRiskLevel:'HIGH',appliedAt:'2026-09-01T00:00:00Z',evaluatedAt:'2026-09-02T00:00:00Z',incidentOccurred:false,outcome:'NO_MATCHING_INCIDENT'},
  {id:2,cause:'MARKET_FRESHNESS',actionKey:key,actionText,sourceRiskScore:.82,sourceRiskLevel:'HIGH',appliedAt:'2026-09-03T00:00:00Z',evaluatedAt:'2026-09-04T00:00:00Z',incidentOccurred:false,outcome:'NO_MATCHING_INCIDENT'},
  {id:3,cause:'MARKET_FRESHNESS',actionKey:key,actionText,sourceRiskScore:.81,sourceRiskLevel:'HIGH',appliedAt:'2026-09-05T00:00:00Z',evaluatedAt:'2026-09-06T00:00:00Z',incidentOccurred:true,outcome:'MATCHING_INCIDENT'}
 ];
 const profiles=buildActionEffectivenessProfiles(events);
 const top=profiles[0];
 return Response.json({
  ok:key.includes('verify-provider-quota')&&top?.sampleSize===3&&top.preventedCount===2&&top.effectivenessScore>.5,
  schemaVersion:'v78-preventive-action-learning-test-1',
  profile:top
 });
}
