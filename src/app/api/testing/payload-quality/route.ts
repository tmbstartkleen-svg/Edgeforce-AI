import {inspectProviderPayload} from '@/lib/providers/payloadQuality';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});
 const fresh=inspectProviderPayload({
  markets:[{id:'m1',updatedAt:new Date().toISOString(),odds:-110}]
 },'ODDS',20);
 const stale=inspectProviderPayload({
  markets:[{id:'m2',updatedAt:new Date(Date.now()-45*60000).toISOString(),odds:-110}]
 },'ODDS',20);
 const empty=inspectProviderPayload({markets:[]},'ODDS',20);
 return Response.json({
  ok:fresh.ok===true&&stale.ok===false&&empty.ok===false,
  fresh,stale,empty
 });
}
