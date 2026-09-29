import {chooseProvider,providerHealth,type ProviderState} from '@/lib/providerRegistry';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});
 const providers:ProviderState[]=[
  {id:'primary',name:'Primary',priority:100,capabilities:['ODDS'],enabled:true,latencyMs:250,errorRate:.95},
  {id:'secondary',name:'Secondary',priority:80,capabilities:['ODDS'],enabled:true,latencyMs:120,errorRate:.02},
  {id:'tertiary',name:'Tertiary',priority:60,capabilities:['ODDS'],enabled:true,latencyMs:800,errorRate:.10}
 ];
 const selected=chooseProvider(providers,'ODDS');
 return Response.json({
  ok:selected?.id==='secondary',
  selected:selected?.id||null,
  health:providers.map(p=>({id:p.id,...providerHealth(p)}))
 });
}
