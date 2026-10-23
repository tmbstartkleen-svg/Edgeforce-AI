import {configuredProviders} from '@/lib/providers/config';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'};
/**
 * No-call provider configuration diagnostic. Never exposes keys, URLs or
 * credential values, and cannot establish live availability or licensing.
 */
export async function GET(){
 try{
  const configured=configuredProviders('ODDS');
  const providers=configured.map(p=>({
   id:p.id,name:p.name,bookmakerLabel:p.bookmaker||p.name,
   credentialConfigured:Boolean(p.apiKey),requiresPaidQuota:p.id==='the-odds-api'||
    p.id==='sports-game-odds',
   classification:p.id==='espn-core-odds'?'PUBLIC_REFERENCE_ODDS':'CONFIGURED_NOT_LIVE_VERIFIED'
  }));
  return Response.json({ok:true,mode:'NO_NETWORK_PROVIDER_CONFIGURATION',
   configuredProviderCount:providers.length,providers,
   liveProviderVerified:false,quoteCountVerified:false,credentialValuesExposed:false,
   paidProviderRequests:0,
   warning:'Configured feeds may be unreachable, quota-limited, empty or stale. Configuration and scoreboard data do not prove DraftKings executable prices.'},{headers});
 }catch{
  return Response.json({ok:false,error:'ODDS_PROVIDER_CONFIGURATION_UNAVAILABLE'},
   {status:503,headers});
 }
}
