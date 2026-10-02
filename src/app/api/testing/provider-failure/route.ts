import {chooseProvider,providerHealth,type ProviderState} from '@/lib/providerRegistry';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});
 const providers:ProviderState[]=[
  {
   id:'primary',name:'Primary',priority:100,capabilities:['ODDS'],enabled:true,
   latencyMs:120,errorRate:.01,freshnessScore:.95,qualityScore:.95,
   circuitState:'OPEN',quarantinedUntil:new Date(Date.now()+5*60000).toISOString(),consecutiveFailures:3
  },
  {
   id:'secondary',name:'Secondary',priority:80,capabilities:['ODDS'],enabled:true,
   latencyMs:150,errorRate:.02,freshnessScore:.94,qualityScore:.92,circuitState:'CLOSED'
  },
  {
   id:'tertiary',name:'Tertiary',priority:60,capabilities:['ODDS'],enabled:true,
   latencyMs:800,errorRate:.10,freshnessScore:.80,qualityScore:.78,circuitState:'CLOSED'
  }
 ];
 const selected=chooseProvider(providers,'ODDS');
 return Response.json({
  ok:selected?.id==='secondary',
  selected:selected?.id||null,
  health:providers.map(p=>({id:p.id,...providerHealth(p)}))
 });
}
