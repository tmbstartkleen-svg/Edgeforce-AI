import {configuredProviders} from '@/lib/providers/config';
import {db} from '@/lib/db';
export const dynamic='force-dynamic';

/** Unified authenticated read-only launch gate. It never polls upstreams or triggers ingestion. */
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret)return Response.json({ok:false,reason:'NOT_CONFIGURED'},{status:503,headers:{'Cache-Control':'no-store'}});
 if(request.headers.get('authorization')!==`Bearer ${secret}`)return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers:{'Cache-Control':'no-store'}});
 const providers=configuredProviders('ODDS').map(p=>({id:p.id,name:p.name,bookmaker:p.bookmaker||p.name,credentialPresent:Boolean(p.apiKey),enabled:p.enabled,maxAgeMin:p.maxAgeMin}));
 const blockers:string[]=[];
 if(!providers.length)blockers.push('NO_ODDS_PROVIDER_CONFIGURED');
 if(!providers.some(p=>p.credentialPresent&&p.enabled))blockers.push('NO_ENABLED_PROVIDER_WITH_CREDENTIAL');
 const sql=db();
 if(!sql){blockers.push('DATABASE_UNAVAILABLE');return Response.json({ok:true,mode:'READ_ONLY_LAUNCH_GATE',status:'BLOCKED',blockers,providers,quoteEvidence:null,liveRequestsMade:0,ingestionTriggered:false},{headers:{'Cache-Control':'no-store'}})}
 try{
  const rows=await sql`select count(*)::int as total,
   count(*) filter(where pulled_at>=now()-interval '20 minutes')::int as fresh,
   count(*) filter(where lower(coalesce(bookmaker,''))='draftkings' and pulled_at>=now()-interval '20 minutes')::int as draftkings_fresh,
   max(pulled_at) as latest
   from market_snapshots`;
  const s=rows[0]||{};
  if(Number(s.fresh||0)===0)blockers.push('NO_QUOTES_STORED_IN_LAST_20_MINUTES');
  if(Number(s.draftkings_fresh||0)===0)blockers.push('NO_DRAFTKINGS_LABELLED_QUOTES_IN_LAST_20_MINUTES');
  if(providers.filter(p=>p.credentialPresent&&p.enabled).length<2)blockers.push('TWO_ENABLED_CREDENTIALLED_PROVIDERS_NOT_CONFIGURED');
  return Response.json({ok:true,mode:'READ_ONLY_LAUNCH_GATE',status:blockers.length?'BLOCKED':'READY_FOR_INDEPENDENT_SOURCE_VALIDATION',generatedAt:new Date().toISOString(),blockers,providers,quoteEvidence:{total:Number(s.total||0),freshLast20Minutes:Number(s.fresh||0),draftKingsLabelledFreshLast20Minutes:Number(s.draftkings_fresh||0),latestPersistedQuoteAt:s.latest||null},independentUpstreamsVerified:0,completeDraftKingsCatalogVerified:false,positiveExpectedValueCertified:false,liveRequestsMade:0,ingestionTriggered:false,notes:['Credential presence is not live-feed proof.','A DraftKings label in storage is not proof of source authenticity; validate provider provenance.','This gate does not poll APIs or initiate writes.']},{headers:{'Cache-Control':'no-store, max-age=0'}});
 }catch{return Response.json({ok:false,mode:'READ_ONLY_LAUNCH_GATE',status:'BLOCKED',blockers:['QUOTE_EVIDENCE_QUERY_FAILED'],providers,liveRequestsMade:0,ingestionTriggered:false},{status:503,headers:{'Cache-Control':'no-store'}})}
}
