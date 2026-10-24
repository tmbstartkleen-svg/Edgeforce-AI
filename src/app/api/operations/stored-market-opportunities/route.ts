import {db} from '@/lib/db';
import {analyzePersistedQuoteEvidence} from '@/lib/intelligence-core/persisted-quote-opportunity-bridge.mjs';
export const dynamic='force-dynamic';
/** Authenticated database-only analysis. Requires explicitly persisted provenance and settlement evidence. */
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret)return Response.json({ok:false,reason:'NOT_CONFIGURED'},{status:503,headers:{'Cache-Control':'no-store'}});
 if(request.headers.get('authorization')!==`Bearer ${secret}`)return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers:{'Cache-Control':'no-store'}});
 const sql=db();if(!sql)return Response.json({ok:false,reason:'DATABASE_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});
 try{
  const rows=await sql`select bookmaker,provider,market_key,selection_key,american_odds,pulled_at,raw
  from market_snapshots where pulled_at>=now()-interval '25 minutes'
  order by pulled_at desc limit 2000`;
  const analysis=analyzePersistedQuoteEvidence(rows,[],{maxAgeMs:1200000,bankroll:100});
  return Response.json({ok:true,analysis,quotesWithCompleteEvidence:analysis.normalized.quotes.length,
   noLiveSourcePolling:true,externalApiRequests:0,writesPerformed:0,
   note:'This endpoint only considers stored observations with explicit source identity and settlement rules; no forecast model supplied, so no model-derived EV picks can be certified.'},
   {headers:{'Cache-Control':'no-store, max-age=0'}});
 }catch{return Response.json({ok:false,reason:'DATABASE_EVIDENCE_AUDIT_FAILED',externalApiRequests:0},{status:503,headers:{'Cache-Control':'no-store'}})}
}
