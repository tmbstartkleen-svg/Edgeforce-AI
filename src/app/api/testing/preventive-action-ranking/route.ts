import {rankPreventiveActions} from '@/lib/preventiveActionRanking';
import {normalizeActionKey} from '@/lib/preventiveActionLearning';

export const dynamic='force-dynamic';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const strong='Refresh provider quota and verify fresh timestamps.';
 const weak='Inspect provider logs.';
 const profiles:any[]=[
  {cause:'MARKET_FRESHNESS',actionKey:normalizeActionKey(strong),effectivenessScore:.84,confidence:.88,sampleSize:10},
  {cause:'MARKET_FRESHNESS',actionKey:normalizeActionKey(weak),effectivenessScore:.48,confidence:.75,sampleSize:8}
 ];
 const ranked=rankPreventiveActions('MARKET_FRESHNESS',.81,[weak,strong],profiles);
 return Response.json({
  ok:ranked[0]?.actionText===strong&&ranked[0]?.priorityScore>ranked[1]?.priorityScore&&ranked[0]?.evidenceQuality==='STRONG',
  schemaVersion:'v79-preventive-action-ranking-test-1',
  ranked
 });
}
