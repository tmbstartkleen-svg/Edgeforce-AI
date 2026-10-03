import {ingestOdds} from '@/lib/providers/ingest';
import {todayTop30,weekTop30} from '@/lib/scanner';
import {loadLearnedWeightMultipliers} from '@/lib/learnedWeights';
import {loadDynamicCalibrationProfiles} from '@/lib/regimeConfidence';
import {enrichMarketsWithContext} from '@/lib/providers/contextFusion';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const {searchParams}=new URL(req.url);
 const view=searchParams.get('view')==='week'?'week':'today';
 const [ingestion,learnedWeights,dynamicCalibration]=await Promise.all([
  ingestOdds(),loadLearnedWeightMultipliers(),loadDynamicCalibrationProfiles()
 ]);
 if(!ingestion.markets.length){
  return Response.json({
   ok:false,view,source:ingestion.source,providerId:ingestion.providerId||null,
   error:'No live or fresh stored sportsbook markets are available',
   warnings:ingestion.warnings
  },{status:503,headers:{'Cache-Control':'no-store'}});
 }
 const context=await enrichMarketsWithContext(ingestion.markets);
 const rows=view==='week'
  ?weekTop30(context.markets,'Moderate',new Date(),learnedWeights,dynamicCalibration)
  :todayTop30(context.markets,'Moderate',new Date(),learnedWeights,dynamicCalibration);
 return Response.json({
  ok:true,view,count:rows.length,horizonDays:view==='week'?8:1,
  source:ingestion.source,providerId:ingestion.providerId||null,
  providerName:ingestion.providerName||null,targetBook:ingestion.targetBook,
  warnings:ingestion.warnings,contextDiagnostics:context.diagnostics,rows
 },{headers:{'Cache-Control':'no-store'}});
}
