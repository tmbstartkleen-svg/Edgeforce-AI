import {configuredProviders} from '@/lib/providers/config';
export const dynamic='force-dynamic';

/** Authenticated, read-only inventory. Never polls odds providers or exposes credentials. */
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret)return Response.json({ok:false,reason:'NOT_CONFIGURED'},{status:503,headers:{'Cache-Control':'no-store'}});
 if(request.headers.get('authorization')!==`Bearer ${secret}`)return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers:{'Cache-Control':'no-store'}});
 const providers=configuredProviders('ODDS').map(p=>({id:p.id,name:p.name,enabled:p.enabled,capability:p.capability,declaredBookmaker:p.bookmaker||p.name,apiKeyPresent:Boolean(p.apiKey),urlConfigured:Boolean(p.url),priority:p.priority,maxAgeMin:p.maxAgeMin}));
 const targetBook=process.env.TARGET_BOOKMAKER||'DraftKings';
 return Response.json({ok:true,mode:'READ_ONLY_CONFIGURATION_DIAGNOSTICS',generatedAt:new Date().toISOString(),targetBook,configuredProviderCount:providers.length,providers,liveOddsObserved:false,independentUpstreamsVerified:0,draftKingsQuotesVerified:false,productionIngestionTriggered:false,apiRequestsMade:0,limitations:['Credential presence is not evidence of successful provider requests or accepted odds.','This endpoint intentionally makes no external provider calls.','Configured provider count does not prove independent upstreams, DraftKings quote availability, complete sports/prop coverage, or positive expected value.']},{headers:{'Cache-Control':'no-store, max-age=0'}});
}
