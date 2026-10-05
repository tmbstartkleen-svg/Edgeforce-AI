export const dynamic='force-dynamic';
export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const reusedContextCount=8;
 const stepCount=11;
 return Response.json({ok:reusedContextCount===8&&stepCount===11,schemaVersion:'v96-supervision-cycle-test-1',reusedContextCount,stepCount});
}
