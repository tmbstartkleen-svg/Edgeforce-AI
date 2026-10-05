import {shouldPromoteChampionBaseline} from '@/lib/preventiveChampionBaseline';
export const dynamic='force-dynamic';
export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const yes=shouldPromoteChampionBaseline({probationState:'FULL',probationStage:4,performanceStatus:'STABLE',degradationScore:.10,calibrationError:.06,brierScore:.14,sampleSize:30});
 const no=shouldPromoteChampionBaseline({probationState:'STAGE_3',probationStage:3,performanceStatus:'STABLE',degradationScore:.10,calibrationError:.06,brierScore:.14,sampleSize:30});
 return Response.json({ok:yes.eligible&&!no.eligible,schemaVersion:'v87-champion-baseline-test-1',yes,no});
}
