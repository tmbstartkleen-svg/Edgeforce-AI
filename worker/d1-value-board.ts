import {checkNetworkAuth} from '../src/lib/firstPartySportsNetwork';
import {buildVerifiedValueBoard} from '../src/lib/verified-value-board';
import {d1CoverageGateway} from './d1-coverage';

const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers});
type Env={CRON_SECRET?:unknown;EDGEFORCE_NETWORK_TOKEN_SHA256?:unknown;INTELLIGENCE_DB?:unknown};

/**
 * Owner-only D1-backed value board readiness. Persistent observations are read,
 * but cannot become verified +EV picks until source entitlement, independent
 * price evidence and independently audited forecast records are actually wired.
 * Nothing in this endpoint accepts caller-provided evidence or writes to D1.
 */
export async function d1ValueBoardGateway(request:Request,env:Env):Promise<Response>{
 if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET',...headers}});
 const bearer=request.headers.get('authorization');
 const authorizedByOwner=typeof env.EDGEFORCE_NETWORK_TOKEN_SHA256==='string'&&
  checkNetworkAuth(bearer,env.EDGEFORCE_NETWORK_TOKEN_SHA256);
 const authorizedByCron=typeof env.CRON_SECRET==='string'&&env.CRON_SECRET.length>=24&&
  bearer==='Bearer '+env.CRON_SECRET;
 if(!authorizedByOwner&&!authorizedByCron)return json({ok:false,error:'UNAUTHORIZED'},401);
 const response=await d1CoverageGateway(request,env);
 if(!response.ok)return response;
 let coverage:Record<string,unknown>;
 try{coverage=await response.json() as Record<string,unknown>;}
 catch{return json({ok:false,error:'D1_COVERAGE_RESPONSE_INVALID'},503);}
 if(coverage.ok!==true||coverage.mode!=='PERSISTED_D1_ODDS')
  return json({ok:false,error:'D1_COVERAGE_UNVERIFIED'},503);
 const now=Date.now();
 // No server-trusted, independently calibrated model-to-quote join exists yet.
 // It would be misleading to turn an observation count into a model forecast.
 const board=buildVerifiedValueBoard([],now,50);
 const independent=coverage.independentVerification as
  {priceCrossVerified?:unknown;verifiedOutcomes?:unknown}|undefined;
 return json({
  ok:true,mode:'READ_ONLY_VALUE_BOARD_READINESS',status:'AWAITING_CERTIFIED_INPUTS',
  asOf:new Date(now).toISOString(),storedCoverageAsOf:coverage.asOf??null,
  rowsInspected:coverage.rowsInspected??0,
  observedFreshDraftKingsQuotes:coverage.freshDraftKingsQuotes??0,
  independentPriceAgreementObserved:independent?.priceCrossVerified===true,
  independentOutcomeCount:typeof independent?.verifiedOutcomes==='number'?independent.verifiedOutcomes:0,
  gates:{
   authenticatedD1Read:{passed:true,note:'Read-only observations accessed; not an ingestion write/readback certificate.'},
   sportsbookEntitlement:{passed:false,reason:'AUTHORIZED_STORAGE_AND_FEED_RIGHTS_NOT_CERTIFIED'},
   calibratedIndependentModel:{passed:false,reason:'SERVER_TRUSTED_MODEL_EVIDENCE_NOT_CONNECTED'},
   executablePrice:{passed:false,reason:'EXECUTABLE_FRESH_PRICE_NOT_CERTIFIED'},
   independentExpectedCatalog:{passed:false,reason:'INDEPENDENT_DRAFTKINGS_CATALOG_NOT_CERTIFIED'},
  },
  board,releaseCertified:false,
  warning:'Observed D1 prices are not model probabilities, verified edge, executable odds, or proof of complete market coverage. No betting recommendations can be returned yet.'
 });
}
