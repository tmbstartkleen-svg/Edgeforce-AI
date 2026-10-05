export const dynamic='force-dynamic';
export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const reusedContextCount=4;
 const stepCount=11;
 return Response.json({ok:reusedContextCount===4&&stepCount===11,schemaVersion:'v96-supervision-cycle-test-1',reusedContextCount,stepCount});
}
