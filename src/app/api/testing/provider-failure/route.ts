import {chooseProvider,providerHealth,type ProviderState} from '@/lib/providerRegistry';

export const dynamic='force-dynamic';

export async function GET(){
  if(process.env.ENABLE_TEST_ENDPOINTS!=='true'){
    return new Response(null,{status:404});
  }

  const now=Date.now();
  const providers:ProviderState[]=[
    {
      id:'primary',
      name:'Primary Odds',
      priority:100,
      capabilities:['ODDS'],
      enabled:true,
      errorRate:.02,
      freshnessScore:.98,
      qualityScore:.95,
      circuitState:'OPEN',
      quarantinedUntil:new Date(now+5*60*1000).toISOString(),
      consecutiveFailures:3
    },
    {
      id:'secondary',
      name:'Secondary Odds',
      priority:80,
      capabilities:['ODDS'],
      enabled:true,
      errorRate:.10,
      freshnessScore:.80,
      qualityScore:.78,
      circuitState:'CLOSED'
    }
  ];

  const selected=chooseProvider(providers,'ODDS',now);

  return Response.json({
    ok:true,
    selected:selected?.id,
    assertions:{
      primaryQuarantined:providerHealth(providers[0],now).quarantined,
      secondarySelected:selected?.id==='secondary'
    },
    providers:providers.map(provider=>({
      id:provider.id,
      health:providerHealth(provider,now)
    }))
  });
}
