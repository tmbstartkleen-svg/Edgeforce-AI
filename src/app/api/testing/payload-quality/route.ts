import {inspectProviderPayload} from '@/lib/providers/payloadQuality';

export const dynamic='force-dynamic';

export async function GET(){

 const fresh=inspectProviderPayload({
  markets:[
   {
    id:'m1',
    updatedAt:new Date().toISOString(),
    odds:-110
   }
  ]
 },'ODDS',20);

 const stale=inspectProviderPayload({
  markets:[
   {
    id:'m2',
    updatedAt:new Date(Date.now()-45*60000).toISOString(),
    odds:-110
   }
  ]
 },'ODDS',20);

 const empty=inspectProviderPayload({
  markets:[]
 },'ODDS',20);

 return Response.json({
  ok:true,
  fresh,
  stale,
  empty
 });
}
