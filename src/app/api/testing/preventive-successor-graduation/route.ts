import {evaluateSuccessorGraduation} from '@/lib/preventiveSuccessorGraduation';
export const dynamic='force-dynamic';
export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const yes=evaluateSuccessorGraduation({championSource:'SUCCESSION_CHAMPION',validationStatus:'CONFIRMED',validationStreak:3});
 const no=evaluateSuccessorGraduation({championSource:'SUCCESSION_CHAMPION',validationStatus:'VALIDATING',validationStreak:2});
 return Response.json({ok:yes.eligible&&yes.status==='GRADUATE'&&!no.eligible,schemaVersion:'v92-successor-graduation-test-1',yes,no});
}
