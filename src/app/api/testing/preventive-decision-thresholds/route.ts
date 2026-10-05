import {derivePreventiveDecisionThresholds} from '@/lib/preventiveDecisionThresholds';

export const dynamic='force-dynamic';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const poor=derivePreventiveDecisionThresholds({sampleSize:30,brierScore:.31,calibrationError:.20,recommendSuccessRate:.50,rejectSuccessRate:.60});
 const strong=derivePreventiveDecisionThresholds({sampleSize:40,brierScore:.11,calibrationError:.05,recommendSuccessRate:.82,rejectSuccessRate:.76});
 return Response.json({
  ok:poor.mode==='CONSERVATIVE'&&poor.recommendThreshold>.72&&strong.mode==='TUNED'&&strong.recommendThreshold>=.70&&strong.recommendThreshold<.72,
  schemaVersion:'v82-preventive-decision-thresholds-test-1',
  poor,strong
 });
}
