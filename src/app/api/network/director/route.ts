import {NETWORK_ORG,hierarchyHealthy} from '@/lib/networkOrganization';
import {runDirectorNetwork} from '@/lib/networkDirector';
import {ingestOdds} from '@/lib/providers/ingest';
import {scanEdgeOpportunities} from '@/lib/edgeScanner';
import {buildTeamResearch} from '@/lib/teamResearch';

export const dynamic='force-dynamic';
const noStore=(value:unknown,status=200)=>Response.json(value,{
 status,headers:{'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'}
});

function getOwnerToken(request:Request){
 const value=request.headers.get('Authorization')||'';
 return value.startsWith('Bearer ')?value.slice(7).trim():'';
}
async function tokenMatches(expected:string,supplied:string){
 if(!expected||!supplied||supplied.length>512)return false;
 const encoder=new TextEncoder();
 const [a,b]=await Promise.all([
  crypto.subtle.digest('SHA-256',encoder.encode(expected)),
  crypto.subtle.digest('SHA-256',encoder.encode(supplied))
 ]);
 const left=new Uint8Array(a),right=new Uint8Array(b);
 let diff=0;
 for(let i=0;i<left.length;i++)diff|=left[i]^right[i];
 return diff===0;
}

export async function GET(){
 return noStore({
  ok:true,network:'EdgeForce Sports Intelligence Network',hierarchyHealthy:hierarchyHealthy(),
  owner:'Founder & Executive Chairman',director:'ATLAS',members:NETWORK_ORG,
  requiresOwnerAuthentication:true,readOnly:true,
  ownerTokenConfigured:Boolean(process.env.EDGEFORCE_NETWORK_OWNER_TOKEN&&process.env.EDGEFORCE_NETWORK_OWNER_TOKEN.length>=24),
  modelConfigured:Boolean(process.env.EDGEFORCE_NETWORK_AI_API_KEY||process.env.OPENAI_API_KEY),
  networkState:'OWNER_APPROVAL_REQUIRED',
  description:'ATLAS plans and delegates real bounded AI research tasks to independent model-assisted directors when credentials are configured. Persistent background operation is not yet enabled.'
 });
}

export async function POST(req:Request){
 const ownerToken=process.env.EDGEFORCE_NETWORK_OWNER_TOKEN||'';
 if(ownerToken.length<24){
  return noStore({ok:false,error:'OWNER_AUTH_NOT_CONFIGURED',message:'Configure the EDGEFORCE_NETWORK_OWNER_TOKEN secret on the Worker before starting AI missions.'},503);
 }
 const authenticated=await tokenMatches(ownerToken,getOwnerToken(req));
 if(!authenticated)return noStore({ok:false,error:'UNAUTHORIZED',message:'A valid Founder access token is required.'},401);
 const aiKey=process.env.EDGEFORCE_NETWORK_AI_API_KEY||process.env.OPENAI_API_KEY||'';
 if(!aiKey)return noStore({ok:false,error:'AI_NOT_CONFIGURED',message:'Configure EDGEFORCE_NETWORK_AI_API_KEY or OPENAI_API_KEY as a Worker secret for real director and division model calls.'},503);
 const bytes=Number(req.headers.get('content-length')||0);
 if(bytes>4096)return noStore({ok:false,error:'REQUEST_TOO_LARGE'},413);
 let question='';
 try{
  const raw=await req.text();
  if(raw.length>4096)return noStore({ok:false,error:'REQUEST_TOO_LARGE'},413);
  const data=JSON.parse(raw) as Record<string,unknown>;
  if(!data||Array.isArray(data)||typeof data!=='object')return noStore({ok:false,error:'INVALID_REQUEST'},400);
  question=typeof data.question==='string'?data.question.trim():'';
 }catch{return noStore({ok:false,error:'INVALID_JSON'},400);}
 if(question.length<3||question.length>500)return noStore({ok:false,error:'INVALID_QUESTION',message:'Provide a sports research question between 3 and 500 characters.'},400);
 try{
  // Shared research snapshot ensures all directors evaluate the same observed data.
  const ingestion=await ingestOdds();
  const marketPanel=ingestion.panelMarkets||[];
  const edge=scanEdgeOpportunities(marketPanel,{minEv:.01,maxArbitrage:25,maxPositiveEv:50});
  const round=buildTeamResearch({
   question,markets:ingestion.markets||[],panelMarkets:marketPanel,source:ingestion.source,
   degraded:ingestion.degraded,providerName:ingestion.providerName,
   warnings:ingestion.warnings,opportunities:edge.positiveEv,arbitrage:edge.arbitrage,
   targetBook:ingestion.targetBook||'DraftKings'
  });
  const result=await runDirectorNetwork({
   question,round,key:aiKey,
   model:process.env.EDGEFORCE_NETWORK_MODEL||'gpt-4.1-mini'
  });
  return noStore({
   ok:true,...result,
   coverage:round.coverage,
   inputSource:{name:ingestion.providerName||null,status:ingestion.source,warnings:ingestion.warnings.slice(0,4)},
   dataQualityCaveat:'Real coverage only where licensed, configured upstream sources return usable market observations. No guaranteed coverage of all DraftKings markets.',
   persistence:'This API performs a bounded request-scoped collaboration run; agents do not run continuously or store autonomous tasks.'
  });
 }catch(error){
  return noStore({
   ok:false,error:'DIRECTOR_NETWORK_FAILED',
   message:error instanceof Error?error.message:'Research unavailable'
  },503);
 }
}
