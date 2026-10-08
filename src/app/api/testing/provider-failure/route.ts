import {chooseProvider,providerHealth,type ProviderState} from '@/lib/providerRegistry';

export const dynamic='force-dynamic';

export async function GET(){

 const providers:ProviderState[]=[
  {
   id:'primary',
   name:'Primary',
   priority:100,
   capabilities:['ODDS'],
   enabled:true,
   latencyMs:120,
   errorRate:.01,
   freshnessScore:.95,
   qualityScore:.95,
   circuitState:'OPEN',
   quarantinedUntil:new Date(Date.now()+5*60000).toISOString()
  },
  {
   id:'secondary',
   name:'Secondary',
   priority:80,
   capabilities:['ODDS'],
   enabled:true,
   latencyMs:150,
   errorRate:.02,
   freshnessScore:.94,
   qualityScore:.92,
   circuitState:'CLOSED'
  },
  {
   id:'tertiary',
   name:'Tertiary',
   priority:60,
   capabilities:['ODDS'],
   enabled:true,
   latencyMs:800,
   errorRate:.10,
   freshnessScore:.80,
   qualityScore:.78,
   circuitState:'CLOSED'
  }
 ];

 const selected=chooseProvider(providers,'ODDS');

 return Response.json({
  ok:true,
  selected:selected?.id,
  providers:providerHealth(providers)
 });
}
