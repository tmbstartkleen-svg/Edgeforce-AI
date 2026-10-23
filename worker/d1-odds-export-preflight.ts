import {checkNetworkAuth} from '../src/lib/firstPartySportsNetwork';
import {assessOddsIngestionPreflight} from '../src/lib/odds-ingestion-preflight';
import type {D1Database} from './d1-observations';

const headers={'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'};
const respond=(body:unknown,status=200)=>Response.json(body,{status,headers});
type Registry={source_id:string;upstream_id:string;source_type:string;enabled:number};
/**
 * Safe launch staging: operator can submit a previously authorized provider
 * export for server-side dry run. NEVER requests paid upstream data, registers
 * sources, persists quotes, or asserts provider ownership/rights. The bound D1
 * is queried only for current source-type status.
 */
export async function d1OddsAuthorizedExportPreflight(
 request:Request,env:{CRON_SECRET?:unknown;EDGEFORCE_NETWORK_TOKEN_SHA256?:unknown;INTELLIGENCE_DB?:unknown}
):Promise<Response>{
 if(request.method!=='POST')return new Response(null,{status:405,headers:{...headers,Allow:'POST'}});
 const owner=typeof env.EDGEFORCE_NETWORK_TOKEN_SHA256==='string'&&
  checkNetworkAuth(request.headers.get('authorization'),env.EDGEFORCE_NETWORK_TOKEN_SHA256);
 const cron=typeof env.CRON_SECRET==='string'&&env.CRON_SECRET.length>=24&&
  request.headers.get('authorization')==='Bearer '+env.CRON_SECRET;
 if(!owner&&!cron)return respond({ok:false,error:'UNAUTHORIZED'},401);
 const db=env.INTELLIGENCE_DB as D1Database|undefined;
 if(!db||typeof db.prepare!=='function')return respond({ok:false,error:'D1_BINDING_MISSING'},503);
 const maxBytes=512*1024;
 if(Number(request.headers.get('content-length')||0)>maxBytes)
  return respond({ok:false,error:'EXPORT_TOO_LARGE'},413);
 let supplied:unknown;
 try{
  const body=await request.text();
  if(new TextEncoder().encode(body).length>maxBytes)
   return respond({ok:false,error:'EXPORT_TOO_LARGE'},413);
  supplied=JSON.parse(body);
 }catch{return respond({ok:false,error:'INVALID_EXPORT_JSON'},400);}
 if(!supplied||typeof supplied!=='object'||Array.isArray(supplied))
  return respond({ok:false,error:'INVALID_EXPORT_OBJECT'},400);
 const input=supplied as Record<string,unknown>;
 if(!Array.isArray(input.events)||input.events.length>500||
  (input.playerPropDryRun!==undefined&&typeof input.playerPropDryRun!=='boolean'))
  return respond({ok:false,error:'INVALID_EXPORT_EVENTS'},400);
 try{
  const preflight=assessOddsIngestionPreflight(input.events,Date.now(),
   {playerPropDryRun:input.playerPropDryRun===true});
  const stored=await db.prepare('SELECT source_id,upstream_id,source_type,enabled FROM intelligence_sources WHERE source_id=? LIMIT 1')
   .bind('the-odds-api').first<Registry>();
  const registrationEligible=Boolean(stored&&stored.enabled===1&&
   stored.source_type==='sportsbook-odds'&&stored.upstream_id==='api.the-odds-api.com');
  const provisional=preflight.provisionalPlayerPropQuotes;
  const blockers=[
   ...(!registrationEligible?['NO_APPROVED_SPORTSBOOK_ODDS_REGISTRATION']:[]),
   ...(preflight.targetQuoteCount===0?['NO_QUALIFYING_DRAFTKINGS_PRICES']:[]),
   ...(preflight.sampleTruncated?['SAMPLE_BATCH_TRUNCATED']:[]),
   ...(provisional?['PROVISIONAL_PLAYER_IDENTITY']:[]),
   'UPSTREAM_AUTHENTICITY_NOT_CONFIRMED',
   'STORAGE_RIGHTS_NOT_INDEPENDENTLY_VERIFIED',
   'SECOND_INDEPENDENT_PROVIDER_NOT_VERIFIED',
   'D1_WRITE_AND_READBACK_NOT_EXECUTED'
  ];
  return respond({ok:true,mode:'AUTHORIZED_EXPORT_REGISTRY_PREFLIGHT_NO_WRITE',
   preflight,registry:{registrationEligible,
    sourceType:stored?.source_type||null,enabled:stored?.enabled===1,
    upstreamMatches:stored?.upstream_id==='api.the-odds-api.com'},
   blockers,canPersist:false,writePerformed:false,providerRequests:0,
   productionApproved:false,verifiedBets:0,
   warning:'Submitted data may be untrusted. This route never fetches, stores or certifies odds; local-only Coverage Studio avoids uploading source exports.'});
 }catch{
  return respond({ok:false,error:'PREFLIGHT_VALIDATION_FAILED'},422);
 }
}
