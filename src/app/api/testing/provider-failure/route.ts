import {chooseProvider,providerHealth,type ProviderState} from '@/lib/providerRegistry';

export const dynamic='force-dynamic';

export async function GET(){
  if(process.env.ENABLE_TEST_ENDPOINTS!=='true'){
    return new Response(null,{status:404});
  }

  const providers:ProviderState[]=[
    {
      id:'PrimaryOdds',
      name:'Primary Odds',
      priority:1,
      capabilities:['ODDS'],
      enabled:true,
      errorRate:.02,
      freshnessScore:.98,
      qualityScore:.95,
      circuitState:'CLOSED'
    },
    {
      id:'BackupOdds',
      name:'Backup Odds',
      priority:2,
      capabilities:['ODDS'],
      enabled:true,
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
    providers:providers.map(provider=>({
      id:provider.id,
      health:providerHealth(provider)
    }))
  });
}
