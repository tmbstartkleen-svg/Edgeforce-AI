import {ingestOdds} from '@/lib/providers/ingest';
import {enrichMarketsWithContext} from '@/lib/providers/contextFusion';
import {expertConsensus,expertModelCatalog,expertSuiteStatus} from '@/lib/expertModelSuite';

export const dynamic='force-dynamic';

export async function GET(){
 const ingestion=await ingestOdds();
 const catalog=expertModelCatalog();
 const status=expertSuiteStatus();

 if(!ingestion.markets.length){
  return Response.json({
   ok:false,build:'V59',schemaVersion:'v59-expert-models-1',
   source:ingestion.source,error:'No live or fresh stored sportsbook markets are available',
   catalog,status,warnings:ingestion.warnings
  },{status:503,headers:{'Cache-Control':'no-store'}});
 }

 const context=await enrichMarketsWithContext(ingestion.markets);
 const rows=context.markets.map(m=>{
  const expert=expertConsensus(m);
  return {
   id:m.id,sport:m.sport,league:m.league,event:m.event,selection:m.selection,market:m.market,
   odds:m.odds,marketProbability:m.marketProb,baseModelProbability:m.modelProb,
   expertProbability:expert.probability,expertEdge:expert.probability-m.marketProb,
   expertModelCount:expert.modelCount,nativeModelCount:expert.nativeCount,externalModelCount:expert.externalCount,
   agreement:expert.agreement,dispersion:expert.dispersion,coverage:expert.coverage,
   models:expert.outputs
  };
 }).sort((a,b)=>b.expertModelCount-a.expertModelCount||Math.abs(b.expertEdge)-Math.abs(a.expertEdge));

 const activeIds=new Set(rows.flatMap(x=>x.models.map(m=>m.id)));
 const enrichedCatalog=catalog.map(entry=>({...entry,activeOnCurrentSlate:activeIds.has(entry.id)}));

 return Response.json({
  ok:true,build:'V59',schemaVersion:'v59-expert-models-1',
  generatedAt:new Date().toISOString(),
  source:ingestion.source,providerId:ingestion.providerId||null,providerName:ingestion.providerName||null,
  targetBook:ingestion.targetBook,
  summary:{
   ...status,
   slateMarkets:rows.length,
   marketsWithFivePlusModels:rows.filter(x=>x.expertModelCount>=5).length,
   marketsWithExternalModels:rows.filter(x=>x.externalModelCount>0).length,
   averageExpertModels:rows.length?rows.reduce((s,x)=>s+x.expertModelCount,0)/rows.length:0,
   averageAgreement:rows.length?rows.reduce((s,x)=>s+x.agreement,0)/rows.length:0
  },
  contextDiagnostics:context.diagnostics,
  catalog:enrichedCatalog,
  topMarkets:rows.slice(0,50),
  warnings:[
   ...(ingestion.warnings||[]),
   'Premium vendor platforms require the user\'s licensed API/data access. Edgeforce does not copy closed proprietary models.',
   'External ML software becomes prediction-active only when EXPERT_MODEL_SERVICE_URL returns normalized, validated probabilities.',
   'Model diversity does not guarantee profitability; V59 drift-monitored champion governance, validation, calibration, drift, and risk gates remain in force.'
  ]
 },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
