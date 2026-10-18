import {ingestOdds} from '@/lib/providers/ingest';
import {scanEdgeOpportunities} from '@/lib/edgeScanner';
import {buildTeamResearch,TEAM_AGENTS} from '@/lib/teamResearch';
import {auditMarketBatch} from '@/lib/dataQuality';

export const dynamic='force-dynamic';

function noStore(payload:unknown,status=200){
 return Response.json(payload,{status,headers:{'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'}});
}

export async function GET(){
 return noStore({
  ok:true,
  service:'EdgeForce Research Team',
  mode:'evidence-first-specialist-workflow',
  agents:TEAM_AGENTS,
  independentLLMEnabled:false,
  userMessagesPersistedOnServer:false,
  description:'Agent collaboration uses explicit deterministic evidence checks. A hosted reasoning model and persistent multi-user team sessions are not yet connected.',
  questionsSupported:true
 });
}

export async function POST(req:Request){
 const size=Number(req.headers.get('content-length')||0);
 if(size>4096)return noStore({ok:false,error:'REQUEST_TOO_LARGE'},413);
 let body:Record<string,unknown>;
 try{
  const raw=await req.text();
  if(raw.length>4096)return noStore({ok:false,error:'REQUEST_TOO_LARGE'},413);
  const parsed=JSON.parse(raw) as unknown;
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return noStore({ok:false,error:'INVALID_REQUEST'},400);
  body=parsed as Record<string,unknown>;
 }catch{return noStore({ok:false,error:'INVALID_JSON'},400);}
 const question=typeof body.question==='string'?body.question.trim():'';
 if(!question||question.length>500)return noStore({ok:false,error:'QUESTION_REQUIRED_OR_TOO_LONG'},400);
 try{
  // Use existing quota-aware provider ingestion; NEVER scrape a sportsbook site.
  const ingestion=await ingestOdds();
  const markets=ingestion.markets||[];
  const panelMarkets=ingestion.panelMarkets||[];
  const edge=scanEdgeOpportunities(panelMarkets,{
   minEv:0.01,maxPositiveEv:50,maxArbitrage:25
  });
  const round=buildTeamResearch({
   question,markets,panelMarkets,
   source:ingestion.source,
   degraded:ingestion.degraded,
   providerName:ingestion.providerName,
   warnings:ingestion.warnings,
   opportunities:edge.positiveEv,
   arbitrage:edge.arbitrage,
   targetBook:ingestion.targetBook||'DraftKings'
  });
  return noStore({
   ok:true,
   generatedAt:new Date().toISOString(),
   question,
   ...round,
   source:{mode:ingestion.mode,name:ingestion.providerName||null,providerId:ingestion.providerId||null,degraded:ingestion.degraded,
     warnings:ingestion.warnings,usedStoredData:ingestion.source==='stored'},
   quality:auditMarketBatch(markets),
   quoteCount:edge.quoteCount,
   referenceEdgeCandidates:edge.positiveEvCount,
   arbitrageCandidates:edge.arbitrageCount,
   nextStep:'Choose one supported event or sport to investigate in more depth.',
   limitations:'Specialists are deterministic research roles, not autonomous LLM bots. Only provided, quota-limited markets are visible. No real-money bet execution.'
  });
 }catch(error){
  return noStore({
   ok:false,error:'TEAM_RESEARCH_UNAVAILABLE',
   message:error instanceof Error?error.message:'Research scan failed',
   generatedAt:new Date().toISOString()
  },503);
 }
}
