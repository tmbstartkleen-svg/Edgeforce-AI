import {ingestOdds} from '@/lib/providers/ingest';
import {enrichMarketsWithContext} from '@/lib/providers/contextFusion';
import {configuredProviders} from '@/lib/providers/config';

export const dynamic='force-dynamic';

export async function GET(){
 const ingestion=await ingestOdds();
 if(!ingestion.markets.length){
  return Response.json({ok:false,source:ingestion.source,error:'No live or stored markets available for context analysis'},{status:503,headers:{'Cache-Control':'no-store'}});
 }

 const enriched=await enrichMarketsWithContext(ingestion.markets);
 const bySport=new Map<string,typeof enriched.markets>();
 for(const market of enriched.markets){
  const list=bySport.get(market.sport)||[];
  list.push(market);
  bySport.set(market.sport,list);
 }

 const sports=[...bySport.entries()].map(([sport,rows])=>{
  const qualities=rows.map(x=>x.contextQuality).filter(Boolean);
  const avg=(key:'score'|'coverage'|'criticalCoverage')=>qualities.length
   ?qualities.reduce((s,x)=>s+Number(x?.[key]||0),0)/qualities.length
   :0;
  return {
   sport,
   rows:rows.length,
   recommendationReady:qualities.filter(x=>x?.recommendationReady).length,
   averageScore:avg('score'),
   averageCoverage:avg('coverage'),
   averageCriticalCoverage:avg('criticalCoverage'),
   missingCritical:[...new Set(qualities.flatMap(x=>x?.missingCritical||[]))].sort()
  };
 }).sort((a,b)=>b.averageScore-a.averageScore||a.sport.localeCompare(b.sport));

 const configured={
  weather:configuredProviders('WEATHER').map(x=>x.id),
  injuries:configuredProviders('INJURIES').map(x=>x.id),
  stats:configuredProviders('STATS').map(x=>x.id)
 };
 const provenance=enriched.markets.flatMap(x=>x.contextProvenance||[]);
 const provenanceBySource=Object.fromEntries(
  [...new Set(provenance.map(x=>x.source))].map(source=>[
   source,
   provenance.filter(x=>x.source===source).length
  ])
 );

 return Response.json({
  ok:true,
  build:'V51',
  source:ingestion.source,
  providerId:ingestion.providerId||null,
  configuredContextProviders:configured,
  provenanceCoverage:{
   rows:enriched.markets.filter(x=>(x.contextProvenance?.length||0)>0).length,
   total:enriched.markets.length,
   records:provenance.length,
   bySource:provenanceBySource
  },
  diagnostics:enriched.diagnostics,
  sports
 },{headers:{'Cache-Control':'no-store'}});
}
